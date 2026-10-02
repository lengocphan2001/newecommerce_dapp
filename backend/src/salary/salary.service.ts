import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SalaryPayment } from './entities/salary-payment.entity';
import { User } from '../user/entities/user.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { runWithDeadlockRetry } from '../common/utils';
import { AgentPoolService } from '../agent-pool/agent-pool.service';
import { AdminService } from '../admin/admin.service';
import { PaySalaryDto } from './dto/pay-salary.dto';
import { SALARY_TIERS, computeSalary } from './salary-tiers';

/**
 * Salaries are paid on this day of the month, for the previous month's
 * results: the salary for 2026-08 can be paid from 2026-09-10 onwards.
 */
export const SALARY_PAY_DAY = 10;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function roundAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

/** First moment (server local time) the salary for `month` can be paid. */
export function salaryPayableFrom(month: string): Date {
  const [year, monthNumber] = month.split('-').map((p) => parseInt(p, 10));
  // monthNumber is 1-based, so as a JS month index it already means "next month".
  return new Date(year, monthNumber, SALARY_PAY_DAY, 0, 0, 0, 0);
}

/** True for MySQL's duplicate key error (errno 1062), wrapped or not. */
export function isDuplicateKeyError(error: any): boolean {
  return [error, error?.driverError, error?.originalError].some(
    (e) => !!e && (Number(e.errno) === 1062 || e.code === 'ER_DUP_ENTRY'),
  );
}

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private readonly salaryPaymentRepo: Repository<SalaryPayment>,
    @InjectRepository(BankingConfig)
    private readonly bankingConfigRepo: Repository<BankingConfig>,
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

  /** USDT/VND rate from Banking Settings, or null when it is not configured. */
  private async getVndRate(): Promise<number | null> {
    const config = await this.bankingConfigRepo.findOne({ where: { id: 1 } });
    const rate = Number(config?.usdtPriceVnd);
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  /**
   * Users whose reward sales ("doanh số tính thưởng", the weak binary branch
   * sales of the month, as on the admin monthly sales page) reach a salary
   * tier, with the tier and the computed gross salary.
   */
  private async getQualifyingUsers(month: string, vndRate: number) {
    const [year, monthNumber] = month.split('-').map((p) => parseInt(p, 10));
    const sales = await this.adminService.getMonthlyBranchSales(
      year,
      monthNumber,
    );
    return sales.flatMap((r) => {
      const { tier, rewardSalesVnd, amount } = computeSalary(
        r.weakSales,
        vndRate,
      );
      return tier ? [{ ...r, rewardSales: r.weakSales, rewardSalesVnd, tier, amount }] : [];
    });
  }

  private async getPaymentsByUser(month: string, userIds: string[]) {
    if (userIds.length === 0) return new Map<string, SalaryPayment>();
    const payments = await this.salaryPaymentRepo.find({
      where: { month, userId: In(userIds) },
    });
    return new Map(payments.map((p) => [p.userId, p]));
  }

  /**
   * Every user qualifying for a salary for the month, with the computed salary
   * and its wallet split, whether it has been paid, and a summary per tier.
   */
  async getEligibleUsers(monthRaw: string) {
    const month = this.assertMonth(monthRaw);
    const payableFrom = salaryPayableFrom(month);
    const [vndRate, distribution] = await Promise.all([
      this.getVndRate(),
      this.agentPoolService.getWalletDistribution(),
    ]);

    const qualifying = vndRate
      ? await this.getQualifyingUsers(month, vndRate)
      : [];
    const payments = await this.getPaymentsByUser(
      month,
      qualifying.map((r) => r.userId),
    );

    const rows = qualifying
      .map((r) => {
        const payment = payments.get(r.userId);
        return {
          userId: r.userId,
          username: r.username,
          fullName: r.fullName,
          email: r.email,
          personalSales: r.personalSales,
          leftSales: r.leftSales,
          rightSales: r.rightSales,
          rewardSales: r.rewardSales,
          rewardSalesVnd: r.rewardSalesVnd,
          tierCode: r.tier.code,
          tierLabel: r.tier.label,
          rate: r.tier.rate,
          salaryAmount: r.amount,
          ...AgentPoolService.splitRewardUsd(r.amount, distribution),
          paid: !!payment,
          paidAmount: payment?.amount ?? 0,
          paidAt: payment?.createdAt ?? null,
          paidBy: payment?.paidBy ?? null,
        };
      })
      .sort((a, b) => b.rewardSales - a.rewardSales);

    const tiers = SALARY_TIERS.map((t) => {
      const tierRows = rows.filter((r) => r.tierCode === t.code);
      return {
        ...t,
        minUsd: vndRate ? roundAmount(t.minVnd / vndRate) : null,
        maxUsd:
          vndRate && t.maxVnd !== null ? roundAmount(t.maxVnd / vndRate) : null,
        userCount: tierRows.length,
        paidCount: tierRows.filter((r) => r.paid).length,
        totalSalary: roundAmount(
          tierRows.reduce((s, r) => s + r.salaryAmount, 0),
        ),
      };
    });

    return {
      month,
      payDay: SALARY_PAY_DAY,
      payableFrom,
      payable: Date.now() >= payableFrom.getTime(),
      vndRate,
      distribution,
      tiers,
      rows,
    };
  }

  /**
   * Pay the computed salary to the listed users, or to every qualifying user
   * not paid yet when `dto.all` is set, and record one `salary_payments` row
   * per user. Tiers and amounts are recomputed here; if any listed user does
   * not qualify or has already been paid for the month, nobody is paid.
   *
   * Paid the same way as an agent pool reward: the gross amount is split with
   * the shared wallet distribution from `system_config` (default 70% withdraw
   * wallet / 20% reconsumption wallet / 10% tax deducted), same rounding.
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

    const vndRate = await this.getVndRate();
    if (!vndRate) {
      throw new BadRequestException(
        'Chưa cấu hình tỉ giá USDT/VND tại Banking Settings',
      );
    }
    const distribution = await this.agentPoolService.getWalletDistribution();

    const qualifying = new Map(
      (await this.getQualifyingUsers(month, vndRate)).map((r) => [r.userId, r]),
    );
    const payments = await this.getPaymentsByUser(month, [
      ...qualifying.keys(),
    ]);

    const nameOf = (userId: string) =>
      qualifying.get(userId)?.username || userId;
    const listNames = (ids: string[]) =>
      ids.slice(0, 10).map(nameOf).join(', ');

    let targets: string[];
    if (dto.all) {
      targets = [...qualifying.keys()].filter((id) => !payments.has(id));
      if (targets.length === 0) {
        throw new BadRequestException(
          `Không còn user nào chưa nhận lương tháng ${month}`,
        );
      }
    } else {
      const unique = new Set(userIds);
      if (unique.size !== userIds.length) {
        throw new BadRequestException('Có user bị chọn hai lần');
      }
      const notQualified = userIds.filter((id) => !qualifying.has(id));
      if (notQualified.length > 0) {
        throw new BadRequestException(
          `${notQualified.length} user không đạt mốc doanh số tính thưởng tháng ${month}: ${listNames(notQualified)}`,
        );
      }
      const alreadyPaid = userIds.filter((id) => payments.has(id));
      if (alreadyPaid.length > 0) {
        throw new BadRequestException(
          `${alreadyPaid.length} user đã nhận lương tháng ${month}: ${listNames(alreadyPaid)}`,
        );
      }
      targets = userIds;
    }

    // Stable lock order across concurrent payouts touching the same users.
    const items = targets
      .map((userId) => {
        const q = qualifying.get(userId)!;
        return {
          userId,
          q,
          amount: q.amount,
          ...AgentPoolService.splitRewardUsd(q.amount, distribution),
        };
      })
      .sort((a, b) => a.userId.localeCompare(b.userId));

    let saved: SalaryPayment[];
    try {
      saved = await runWithDeadlockRetry(
        () =>
          this.dataSource.transaction(async (manager) => {
            const rows: SalaryPayment[] = [];
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
              const { tier } = item.q;
              rows.push(
                manager.create(SalaryPayment, {
                  userId: item.userId,
                  month,
                  rewardSales: item.q.rewardSales,
                  tierMin: roundAmount(tier.minVnd / vndRate),
                  tierMax:
                    tier.maxVnd === null
                      ? null
                      : roundAmount(tier.maxVnd / vndRate),
                  tierCode: tier.code,
                  rate: tier.rate,
                  vndRate,
                  amount: item.amount,
                  withdrawAmount: item.withdrawAmount,
                  reconsumptionAmount: item.reconsumptionAmount,
                  taxAmount: item.taxAmount,
                  note,
                  paidBy,
                }),
              );
            }
            return manager.save(rows);
          }),
        {
          onRetry: (attempt, error: unknown) =>
            this.logger.warn(
              `Salary ${month}: lock conflict (attempt ${attempt}), retrying — ${error instanceof Error ? error.message : String(error)}`,
            ),
        },
      );
    } catch (error) {
      // Another request paid one of these users in the meantime; the whole
      // transaction was rolled back, so nobody in this request was paid.
      if (isDuplicateKeyError(error)) {
        throw new BadRequestException(
          `Có user vừa được trả lương tháng ${month} bởi thao tác khác. Không ai trong lần này được trả, hãy tải lại danh sách.`,
        );
      }
      throw error;
    }

    const sum = (pick: (i: (typeof items)[number]) => number) =>
      roundAmount(items.reduce((total, i) => total + pick(i), 0));
    const totalAmount = sum((i) => i.amount);
    const totalWithdrawAmount = sum((i) => i.withdrawAmount);
    const totalReconsumptionAmount = sum((i) => i.reconsumptionAmount);
    const totalTaxAmount = sum((i) => i.taxAmount);

    this.logger.log(
      `[ADMIN] salary month=${month} users=${items.length} total=${totalAmount} withdraw=${totalWithdrawAmount} reconsumption=${totalReconsumptionAmount} tax=${totalTaxAmount} USDT vndRate=${vndRate} by=${paidBy}. Split: withdraw ${distribution.withdrawPercent}%, reconsumption ${distribution.reconsumptionPercent}%, tax ${distribution.taxPercent}%.`,
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

    const tierLabels = new Map(SALARY_TIERS.map((t) => [t.code, t.label]));

    return {
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.user?.username || '',
        fullName: p.user?.fullName || '',
        email: p.user?.email || '',
        month: p.month,
        rewardSales: p.rewardSales,
        tierMin: p.tierMin,
        tierMax: p.tierMax,
        tierCode: p.tierCode,
        tierLabel: p.tierCode ? tierLabels.get(p.tierCode) || p.tierCode : null,
        rate: p.rate,
        vndRate: p.vndRate,
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
