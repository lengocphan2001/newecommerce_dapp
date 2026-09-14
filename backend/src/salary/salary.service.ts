import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SalaryPayment } from './entities/salary-payment.entity';
import { UserMonthlyStats } from '../affiliate/entities/user-monthly-stats.entity';
import { User } from '../user/entities/user.entity';
import { MONTHLY_RANK_ORDER } from '../common/constants/ranks';
import { runWithDeadlockRetry } from '../common/utils';
import { AgentPoolService } from '../agent-pool/agent-pool.service';
import { PaySalaryDto } from './dto/pay-salary.dto';

/** Lowest rank that earns a monthly salary. */
export const SALARY_MIN_RANK = 'C1';

/**
 * Salaries are paid on this day of the month, for the previous month's closed
 * results: the salary for 2026-08 can be paid from 2026-09-10 onwards.
 */
export const SALARY_PAY_DAY = 10;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function roundAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

function isSalaryRank(rank: string | null | undefined): boolean {
  return (
    MONTHLY_RANK_ORDER.indexOf(rank || 'C0') >=
    MONTHLY_RANK_ORDER.indexOf(SALARY_MIN_RANK)
  );
}

/** First moment (server local time) the salary for `month` can be paid. */
export function salaryPayableFrom(month: string): Date {
  const [year, monthNumber] = month.split('-').map((p) => parseInt(p, 10));
  // monthNumber is 1-based, so as a JS month index it already means "next month".
  return new Date(year, monthNumber, SALARY_PAY_DAY, 0, 0, 0, 0);
}

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private readonly salaryPaymentRepo: Repository<SalaryPayment>,
    @InjectRepository(UserMonthlyStats)
    private readonly monthlyStatsRepo: Repository<UserMonthlyStats>,
    private readonly dataSource: DataSource,
    private readonly agentPoolService: AgentPoolService,
  ) {}

  private assertMonth(month: string | undefined): string {
    if (!month || !MONTH_PATTERN.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    return month;
  }

  /**
   * Agents who qualify for a salary in a closed month, with what has already
   * been paid to them for that month.
   *
   * Qualification is read from `user_monthly_stats`, i.e. the result of the
   * monthly closing, so a month that has not been closed has no one to pay.
   */
  async getEligibleUsers(monthRaw: string) {
    const month = this.assertMonth(monthRaw);
    const payableFrom = salaryPayableFrom(month);

    const stats = await this.monthlyStatsRepo.find({
      where: { month },
      relations: ['user'],
    });

    const eligible = stats.filter((s) => isSalaryRank(s.calculatedRank));

    const paidRows = eligible.length
      ? await this.salaryPaymentRepo
          .createQueryBuilder('p')
          .select('p.userId', 'userId')
          .addSelect('COALESCE(SUM(p.amount), 0)', 'paidAmount')
          .addSelect('COUNT(*)', 'paidCount')
          .addSelect('MAX(p.createdAt)', 'lastPaidAt')
          .where('p.month = :month', { month })
          .andWhere('p.userId IN (:...userIds)', {
            userIds: eligible.map((s) => s.userId),
          })
          .groupBy('p.userId')
          .getRawMany<{
            userId: string;
            paidAmount: string;
            paidCount: string;
            lastPaidAt: Date | string | null;
          }>()
      : [];
    const paidMap = new Map(paidRows.map((r) => [r.userId, r]));

    const rows = eligible
      .map((s) => {
        const paid = paidMap.get(s.userId);
        return {
          userId: s.userId,
          username: s.user?.username || '',
          fullName: s.user?.fullName || '',
          email: s.user?.email || '',
          rank: s.calculatedRank,
          personalSales: Number(s.personalSales) || 0,
          groupSales: Number(s.groupSales) || 0,
          isProcessed: s.isProcessed,
          paidAmount: paid ? parseFloat(paid.paidAmount) || 0 : 0,
          paidCount: paid ? parseInt(paid.paidCount, 10) || 0 : 0,
          lastPaidAt: paid?.lastPaidAt ?? null,
        };
      })
      .sort(
        (a, b) =>
          MONTHLY_RANK_ORDER.indexOf(b.rank) -
            MONTHLY_RANK_ORDER.indexOf(a.rank) || b.groupSales - a.groupSales,
      );

    return {
      month,
      closed: stats.length > 0,
      minRank: SALARY_MIN_RANK,
      payDay: SALARY_PAY_DAY,
      payableFrom,
      payable: Date.now() >= payableFrom.getTime(),
      distribution: await this.agentPoolService.getWalletDistribution(),
      rows,
    };
  }

  /**
   * Pay a salary to each listed agent and record one `salary_payments` row per
   * user. Paid the same way as an agent pool reward: the gross amount is split
   * with the shared wallet distribution from `system_config` (default 70%
   * withdraw wallet / 20% reconsumption wallet / 10% tax deducted), using the
   * same rounding. All or nothing: if any user does not qualify, nobody is paid.
   */
  async paySalaries(dto: PaySalaryDto, paidBy: string) {
    const month = this.assertMonth(dto.month);
    const note = (dto.note || '').trim().slice(0, 500) || null;

    const payableFrom = salaryPayableFrom(month);
    if (Date.now() < payableFrom.getTime()) {
      const d = payableFrom;
      throw new BadRequestException(
        `Lương tháng ${month} chỉ được trả từ ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
      );
    }

    const distribution = await this.agentPoolService.getWalletDistribution();

    const seen = new Set<string>();
    const items = dto.items.map((item) => {
      const amount = roundAmount(Number(item.amount));
      if (amount <= 0) {
        throw new BadRequestException(`Invalid amount for user ${item.userId}`);
      }
      if (seen.has(item.userId)) {
        throw new BadRequestException(`User ${item.userId} is listed twice`);
      }
      seen.add(item.userId);
      return {
        userId: item.userId,
        amount,
        ...AgentPoolService.splitRewardUsd(amount, distribution),
      };
    });

    const stats = await this.monthlyStatsRepo.find({
      where: { month, userId: In(items.map((i) => i.userId)) },
      relations: ['user'],
    });
    const statsMap = new Map(stats.map((s) => [s.userId, s]));

    const notEligible = items.filter(
      (i) => !isSalaryRank(statsMap.get(i.userId)?.calculatedRank),
    );
    if (notEligible.length > 0) {
      const names = notEligible
        .slice(0, 10)
        .map((i) => statsMap.get(i.userId)?.user?.username || i.userId)
        .join(', ');
      throw new BadRequestException(
        `${notEligible.length} user không đạt ${SALARY_MIN_RANK} trở lên trong tháng ${month} (hoặc tháng chưa chốt): ${names}`,
      );
    }

    // Stable lock order across concurrent payouts touching the same users.
    items.sort((a, b) => a.userId.localeCompare(b.userId));

    const saved = await runWithDeadlockRetry(
      () =>
        this.dataSource.transaction(async (manager) => {
          const payments: SalaryPayment[] = [];
          for (const item of items) {
            if (item.withdrawAmount > 0) {
              await manager.increment(
                User,
                { id: item.userId },
                'withdrawWalletBalance',
                item.withdrawAmount,
              );
            }
            if (item.reconsumptionAmount > 0) {
              await manager.increment(
                User,
                { id: item.userId },
                'reconsumptionWalletBalance',
                item.reconsumptionAmount,
              );
            }
            payments.push(
              manager.create(SalaryPayment, {
                userId: item.userId,
                month,
                rank: statsMap.get(item.userId)!.calculatedRank,
                amount: item.amount,
                withdrawAmount: item.withdrawAmount,
                reconsumptionAmount: item.reconsumptionAmount,
                taxAmount: item.taxAmount,
                note,
                paidBy,
              }),
            );
          }
          return manager.save(payments);
        }),
      {
        onRetry: (attempt, error: unknown) =>
          this.logger.warn(
            `Salary ${month}: lock conflict (attempt ${attempt}), retrying — ${error instanceof Error ? error.message : String(error)}`,
          ),
      },
    );

    const sum = (pick: (i: (typeof items)[number]) => number) =>
      roundAmount(items.reduce((total, i) => total + pick(i), 0));
    const totalAmount = sum((i) => i.amount);
    const totalWithdrawAmount = sum((i) => i.withdrawAmount);
    const totalReconsumptionAmount = sum((i) => i.reconsumptionAmount);
    const totalTaxAmount = sum((i) => i.taxAmount);

    this.logger.log(
      `[ADMIN] salary month=${month} users=${items.length} total=${totalAmount} withdraw=${totalWithdrawAmount} reconsumption=${totalReconsumptionAmount} tax=${totalTaxAmount} USDT by=${paidBy}. Split: withdraw ${distribution.withdrawPercent}%, reconsumption ${distribution.reconsumptionPercent}%, tax ${distribution.taxPercent}%.`,
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

  /** Salary payment history for the admin panel, newest first. */
  async getPayments(query: {
    month?: string;
    search?: string;
    page?: string | number;
    limit?: string | number;
  }) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(String(query.limit || 20), 10) || 20),
    );

    const qb = this.salaryPaymentRepo
      .createQueryBuilder('p')
      .leftJoin('p.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.fullName', 'u.email']);

    if (query.month) {
      qb.andWhere('p.month = :month', { month: this.assertMonth(query.month) });
    }
    const search = (query.search || '').trim();
    if (search) {
      qb.andWhere(
        '(u.username LIKE :q OR u.fullName LIKE :q OR u.email LIKE :q OR p.userId = :exact)',
        { q: `%${search}%`, exact: search },
      );
    }

    const totalRow = await qb
      .clone()
      .select('COALESCE(SUM(p.amount), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(p.withdrawAmount), 0)', 'totalWithdrawAmount')
      .addSelect(
        'COALESCE(SUM(p.reconsumptionAmount), 0)',
        'totalReconsumptionAmount',
      )
      .addSelect('COALESCE(SUM(p.taxAmount), 0)', 'totalTaxAmount')
      .getRawOne<{
        totalAmount: string;
        totalWithdrawAmount: string;
        totalReconsumptionAmount: string;
        totalTaxAmount: string;
      }>();

    const [items, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.user?.username || '',
        fullName: p.user?.fullName || '',
        email: p.user?.email || '',
        month: p.month,
        rank: p.rank,
        amount: p.amount,
        withdrawAmount: p.withdrawAmount,
        reconsumptionAmount: p.reconsumptionAmount,
        taxAmount: p.taxAmount,
        note: p.note,
        paidBy: p.paidBy,
        createdAt: p.createdAt,
      })),
      total,
      totalAmount: parseFloat(totalRow?.totalAmount || '0') || 0,
      totalWithdrawAmount:
        parseFloat(totalRow?.totalWithdrawAmount || '0') || 0,
      totalReconsumptionAmount:
        parseFloat(totalRow?.totalReconsumptionAmount || '0') || 0,
      totalTaxAmount: parseFloat(totalRow?.totalTaxAmount || '0') || 0,
      page,
      limit,
    };
  }
}
