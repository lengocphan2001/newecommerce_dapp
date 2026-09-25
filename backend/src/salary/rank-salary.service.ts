import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RankSalaryPayment } from './entities/rank-salary-payment.entity';
import { User } from '../user/entities/user.entity';
import { UserMonthlyStats } from '../affiliate/entities/user-monthly-stats.entity';
import { runWithDeadlockRetry } from '../common/utils';
import { AgentPoolService } from '../agent-pool/agent-pool.service';
import { AdminService } from '../admin/admin.service';
import { PaySalaryDto } from './dto/pay-salary.dto';
import { RANK_SALARY_RANKS, computeRankSalaries } from './rank-salary';
import {
  SALARY_PAY_DAY,
  isDuplicateKeyError,
  roundAmount,
  salaryPayableFrom,
} from './salary.service';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Rank salary for C1 / C2 agents, shared out of the C1 and C2 pools built from
 * the month's reward sales (see rank-salary.ts). Paid on the same schedule and
 * with the same wallet split as the tier salary in SalaryService, but recorded
 * separately in `rank_salary_payments`.
 */
@Injectable()
export class RankSalaryService {
  private readonly logger = new Logger(RankSalaryService.name);

  constructor(
    @InjectRepository(RankSalaryPayment)
    private readonly paymentRepo: Repository<RankSalaryPayment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserMonthlyStats)
    private readonly monthlyStatsRepo: Repository<UserMonthlyStats>,
    private readonly dataSource: DataSource,
    private readonly agentPoolService: AgentPoolService,
    private readonly adminService: AdminService,
  ) {}

  private assertMonth(month: string | undefined): string {
    if (!month || !MONTH_PATTERN.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    return month;
  }

  /**
   * C1 / C2 agents with their reward sales for the month, and the pools and
   * shares computed from them.
   *
   * Only agents who were C1 / C2 in that month are paid: a promotion in a later
   * month does not count for this month. The rank of a month is the one the
   * monthly closing stored for it (`user_monthly_stats.calculatedRank`), which
   * already lets a manual rank win over the one computed from sales.
   *
   * A month that was never closed has no stats row at all; the rank then falls
   * back to what the agent pools record: the highest pool of C1..C9 the agent
   * had joined before the month ended (`agent_pool_members.createdAt`). Adding
   * an agent to a pool by hand is dated when the admin did it, not when the
   * agent reached the rank, so the stored month rank is the better source
   * whenever it exists.
   */
  private async computeMonth(month: string) {
    const [year, monthNumber] = month.split('-').map((p) => parseInt(p, 10));
    // Same local-time month bounds as AdminService.getMonthlyBranchSales.
    const monthEnd = new Date(year, monthNumber, 1, 0, 0, 0, 0);

    const ranksMap = await this.getMonthRanks(month, monthEnd);
    const rankedIds = [...ranksMap.entries()]
      .filter(([, rank]) => RANK_SALARY_RANKS.includes(rank))
      .map(([userId]) => userId);
    if (rankedIds.length === 0) return computeRankSalaries([]);

    const [users, branchSales] = await Promise.all([
      this.userRepo.find({
        select: ['id', 'username', 'fullName', 'email'],
        where: { id: In(rankedIds) },
      }),
      this.adminService.getMonthlyBranchSales(year, monthNumber),
    ]);
    const sales = new Map(branchSales.map((r) => [r.userId, r.weakSales]));

    return computeRankSalaries(
      users.map((u) => ({
        userId: u.id,
        username: u.username || '',
        fullName: u.fullName || '',
        email: u.email || '',
        rank: ranksMap.get(u.id)!,
        rewardSales: sales.get(u.id) || 0,
      })),
    );
  }

  /** Rank of every agent in the month, from the closing stats or the pools. */
  private async getMonthRanks(
    month: string,
    monthEnd: Date,
  ): Promise<Map<string, string>> {
    const stats = await this.monthlyStatsRepo.find({
      select: ['userId', 'calculatedRank'],
      where: { month },
    });
    if (stats.length > 0) {
      return new Map(
        stats.map((s) => [s.userId, (s.calculatedRank || 'C0').toUpperCase()]),
      );
    }

    this.logger.warn(
      `Lương cấp bậc ${month}: chưa chốt tháng, lấy cấp bậc theo thời gian vào bể đại lý`,
    );
    return this.agentPoolService.getRanksByPoolJoin(monthEnd);
  }

  private async getPaymentsByUser(month: string, userIds: string[]) {
    if (userIds.length === 0) return new Map<string, RankSalaryPayment>();
    const payments = await this.paymentRepo.find({
      where: { month, userId: In(userIds) },
    });
    return new Map(payments.map((p) => [p.userId, p]));
  }

  /** Every C1 / C2 agent for the month with their salary and paid status. */
  async getEligibleUsers(monthRaw: string) {
    const month = this.assertMonth(monthRaw);
    const payableFrom = salaryPayableFrom(month);
    const [{ pools, rows }, distribution] = await Promise.all([
      this.computeMonth(month),
      this.agentPoolService.getWalletDistribution(),
    ]);
    // Paid rows for the month, including agents whose rank has dropped since.
    const payments = await this.paymentRepo.find({
      where: { month },
      relations: ['user'],
    });
    const paymentByUser = new Map(payments.map((p) => [p.userId, p]));

    const toRow = (r: (typeof rows)[number]) => {
      const payment = paymentByUser.get(r.userId);
      return {
        userId: r.userId,
        username: r.username,
        fullName: r.fullName,
        email: r.email,
        rank: r.rank,
        rewardSales: r.rewardSales,
        c1Share: r.c1Share,
        c2Share: r.c2Share,
        salaryAmount: r.amount,
        ...AgentPoolService.splitRewardUsd(r.amount, distribution),
        paid: !!payment,
        paidAmount: payment?.amount ?? 0,
        paidAt: payment?.createdAt ?? null,
        paidBy: payment?.paidBy ?? null,
      };
    };

    const listed = new Set(rows.map((r) => r.userId));
    const paidElsewhere = payments
      .filter((p) => !listed.has(p.userId))
      .map((p) =>
        toRow({
          userId: p.userId,
          username: p.user?.username || '',
          fullName: p.user?.fullName || '',
          email: p.user?.email || '',
          rank: p.rank,
          rewardSales: p.rewardSales,
          c1Share: p.c1Share,
          c2Share: p.c2Share,
          amount: p.amount,
        }),
      );

    return {
      month,
      payDay: SALARY_PAY_DAY,
      payableFrom,
      payable: Date.now() >= payableFrom.getTime(),
      distribution,
      pools: pools.map((p) => ({
        code: p.code,
        label: p.label,
        ranks: p.ranks,
        rate: p.rate,
        memberCount: p.memberCount,
        sales: p.sales,
        poolAmount: p.poolAmount,
        share: p.share,
      })),
      rows: [...rows.map(toRow), ...paidElsewhere].sort(
        (a, b) => b.rank.localeCompare(a.rank) || b.rewardSales - a.rewardSales,
      ),
    };
  }

  /**
   * Pay the rank salary to the listed agents, or to every unpaid C1 / C2 agent
   * with a non-zero salary when `dto.all` is set. Pools and shares are
   * recomputed here from everyone who was C1 / C2 in that month; if any listed
   * agent is not C1 / C2, has nothing to receive, or
   * was already paid for the month, nobody is paid.
   */
  async paySalaries(dto: PaySalaryDto, paidBy: string) {
    const month = this.assertMonth(dto.month);
    const note = (dto.note || '').trim().slice(0, 500) || null;
    const userIds = dto.userIds ?? [];
    if (!dto.all && userIds.length === 0) {
      throw new BadRequestException('Chọn user cần trả lương');
    }

    const payableFrom = salaryPayableFrom(month);
    if (Date.now() < payableFrom.getTime()) {
      const d = payableFrom;
      throw new BadRequestException(
        `Lương tháng ${month} chỉ được trả từ ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      );
    }

    const distribution = await this.agentPoolService.getWalletDistribution();
    const { pools, rows } = await this.computeMonth(month);
    const [c1Pool, c2Pool] = pools;
    const members = new Map(rows.map((r) => [r.userId, r]));
    const payments = await this.getPaymentsByUser(month, [...members.keys()]);

    const listNames = (ids: string[]) =>
      ids
        .slice(0, 10)
        .map((id) => members.get(id)?.username || id)
        .join(', ');

    let targets: string[];
    if (dto.all) {
      targets = rows
        .filter((r) => r.amount > 0 && !payments.has(r.userId))
        .map((r) => r.userId);
      if (targets.length === 0) {
        throw new BadRequestException(
          `Không còn user C1/C2 nào chưa nhận lương cấp bậc tháng ${month}`,
        );
      }
    } else {
      if (new Set(userIds).size !== userIds.length) {
        throw new BadRequestException('Có user bị chọn hai lần');
      }
      const notMember = userIds.filter((id) => !members.has(id));
      if (notMember.length > 0) {
        throw new BadRequestException(
          `${notMember.length} user không phải C1/C2: ${listNames(notMember)}`,
        );
      }
      const zero = userIds.filter((id) => !(members.get(id)!.amount > 0));
      if (zero.length > 0) {
        throw new BadRequestException(
          `${zero.length} user có lương cấp bậc tháng ${month} bằng 0: ${listNames(zero)}`,
        );
      }
      const alreadyPaid = userIds.filter((id) => payments.has(id));
      if (alreadyPaid.length > 0) {
        throw new BadRequestException(
          `${alreadyPaid.length} user đã nhận lương cấp bậc tháng ${month}: ${listNames(alreadyPaid)}`,
        );
      }
      targets = userIds;
    }

    // Stable lock order across concurrent payouts touching the same users.
    const items = targets
      .map((userId) => {
        const m = members.get(userId)!;
        return {
          m,
          ...AgentPoolService.splitRewardUsd(m.amount, distribution),
        };
      })
      .sort((a, b) => a.m.userId.localeCompare(b.m.userId));

    let saved: RankSalaryPayment[];
    try {
      saved = await runWithDeadlockRetry(
        () =>
          this.dataSource.transaction(async (manager) => {
            const records: RankSalaryPayment[] = [];
            for (const item of items) {
              const { m } = item;
              if (item.withdrawAmount > 0) {
                await manager.increment(
                  User,
                  { id: m.userId },
                  'withdrawWalletBalance',
                  item.withdrawAmount,
                );
              }
              if (item.reconsumptionAmount > 0) {
                await manager.increment(
                  User,
                  { id: m.userId },
                  'reconsumptionWalletBalance',
                  item.reconsumptionAmount,
                );
              }
              records.push(
                manager.create(RankSalaryPayment, {
                  userId: m.userId,
                  month,
                  rank: m.rank,
                  rewardSales: m.rewardSales,
                  c1PoolAmount: c1Pool.poolAmount,
                  c1MemberCount: c1Pool.memberCount,
                  c2PoolAmount: c2Pool.poolAmount,
                  c2MemberCount: c2Pool.memberCount,
                  c1Share: m.c1Share,
                  c2Share: m.c2Share,
                  amount: m.amount,
                  withdrawAmount: item.withdrawAmount,
                  reconsumptionAmount: item.reconsumptionAmount,
                  taxAmount: item.taxAmount,
                  note,
                  paidBy,
                }),
              );
            }
            return manager.save(records);
          }),
        {
          onRetry: (attempt, error: unknown) =>
            this.logger.warn(
              `Rank salary ${month}: lock conflict (attempt ${attempt}), retrying — ${error instanceof Error ? error.message : String(error)}`,
            ),
        },
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new BadRequestException(
          `Có user vừa được trả lương cấp bậc tháng ${month} bởi thao tác khác. Không ai trong lần này được trả, hãy tải lại danh sách.`,
        );
      }
      throw error;
    }

    const sum = (pick: (i: (typeof items)[number]) => number) =>
      roundAmount(items.reduce((total, i) => total + pick(i), 0));
    const totalAmount = sum((i) => i.m.amount);
    const totalWithdrawAmount = sum((i) => i.withdrawAmount);
    const totalReconsumptionAmount = sum((i) => i.reconsumptionAmount);
    const totalTaxAmount = sum((i) => i.taxAmount);

    this.logger.log(
      `[ADMIN] rank salary month=${month} users=${items.length} total=${totalAmount} withdraw=${totalWithdrawAmount} reconsumption=${totalReconsumptionAmount} tax=${totalTaxAmount} USDT pools C1=${c1Pool.poolAmount}/${c1Pool.memberCount} C2=${c2Pool.poolAmount}/${c2Pool.memberCount} by=${paidBy}.`,
    );

    return {
      month,
      count: saved.length,
      totalAmount,
      totalWithdrawAmount,
      totalReconsumptionAmount,
      totalTaxAmount,
      paymentIds: saved.map((p) => p.id),
    };
  }
}
