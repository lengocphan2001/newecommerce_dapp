import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SalaryPayment } from './entities/salary-payment.entity';
import { User } from '../user/entities/user.entity';
import { runWithDeadlockRetry } from '../common/utils';
import { AgentPoolService } from '../agent-pool/agent-pool.service';
import { AdminService } from '../admin/admin.service';
import { PaySalaryDto } from './dto/pay-salary.dto';

/**
 * Salaries are paid on this day of the month, for the previous month's
 * results: the salary for 2026-08 can be paid from 2026-09-10 onwards.
 */
export const SALARY_PAY_DAY = 10;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function roundAmount(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

/** First moment (server local time) the salary for `month` can be paid. */
export function salaryPayableFrom(month: string): Date {
  const [year, monthNumber] = month.split('-').map((p) => parseInt(p, 10));
  // monthNumber is 1-based, so as a JS month index it already means "next month".
  return new Date(year, monthNumber, SALARY_PAY_DAY, 0, 0, 0, 0);
}

/**
 * Whether reward sales fall in a salary tier: at least `minSales` and, when
 * the tier is bounded, below `maxSales`. The upper bound is exclusive so
 * adjacent tiers (e.g. 1000-5000 and 5000-10000) never overlap.
 */
export function inSalaryTier(
  rewardSales: number,
  minSales: number,
  maxSales?: number | null,
): boolean {
  return (
    rewardSales > 0 &&
    rewardSales >= minSales &&
    (maxSales === null || maxSales === undefined || rewardSales < maxSales)
  );
}

function parseOptionalSales(raw: unknown, name: string): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException(`${name} must be a non-negative number`);
  }
  return n;
}

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(
    @InjectRepository(SalaryPayment)
    private readonly salaryPaymentRepo: Repository<SalaryPayment>,
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

  private assertTier(minSales: number, maxSales: number | null) {
    if (maxSales !== null && maxSales <= minSales) {
      throw new BadRequestException('maxSales must be greater than minSales');
    }
  }

  /**
   * Reward sales ("doanh số tính thưởng") of every user for a month: the weak
   * binary branch sales, as shown on the admin monthly sales page.
   */
  private async getRewardSales(month: string) {
    const [year, monthNumber] = month.split('-').map((p) => parseInt(p, 10));
    return this.adminService.getMonthlyBranchSales(year, monthNumber);
  }

  /**
   * Users whose reward sales for the month fall in the requested tier, with
   * what has already been paid to them for that month.
   */
  async getEligibleUsers(
    monthRaw: string,
    minSalesRaw?: unknown,
    maxSalesRaw?: unknown,
  ) {
    const month = this.assertMonth(monthRaw);
    const minSales = parseOptionalSales(minSalesRaw, 'minSales') ?? 0;
    const maxSales = parseOptionalSales(maxSalesRaw, 'maxSales');
    this.assertTier(minSales, maxSales);
    const payableFrom = salaryPayableFrom(month);

    const sales = (await this.getRewardSales(month)).filter((r) =>
      inSalaryTier(r.weakSales, minSales, maxSales),
    );

    const paidRows = sales.length
      ? await this.salaryPaymentRepo
          .createQueryBuilder('p')
          .select('p.userId', 'userId')
          .addSelect('COALESCE(SUM(p.amount), 0)', 'paidAmount')
          .addSelect('COUNT(*)', 'paidCount')
          .addSelect('MAX(p.createdAt)', 'lastPaidAt')
          .where('p.month = :month', { month })
          .andWhere('p.userId IN (:...userIds)', {
            userIds: sales.map((r) => r.userId),
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

    const rows = sales
      .map((r) => {
        const paid = paidMap.get(r.userId);
        return {
          userId: r.userId,
          username: r.username,
          fullName: r.fullName,
          email: r.email,
          personalSales: r.personalSales,
          leftSales: r.leftSales,
          rightSales: r.rightSales,
          rewardSales: r.weakSales,
          paidAmount: paid ? parseFloat(paid.paidAmount) || 0 : 0,
          paidCount: paid ? parseInt(paid.paidCount, 10) || 0 : 0,
          lastPaidAt: paid?.lastPaidAt ?? null,
        };
      })
      .sort((a, b) => b.rewardSales - a.rewardSales);

    return {
      month,
      minSales,
      maxSales,
      payDay: SALARY_PAY_DAY,
      payableFrom,
      payable: Date.now() >= payableFrom.getTime(),
      distribution: await this.agentPoolService.getWalletDistribution(),
      rows,
    };
  }

  /**
   * Pay a salary to each listed user and record one `salary_payments` row per
   * user. Every user must have reward sales for the month inside the tier
   * (recomputed here, not trusted from the client), or nobody is paid.
   *
   * Paid the same way as an agent pool reward: the gross amount is split with
   * the shared wallet distribution from `system_config` (default 70% withdraw
   * wallet / 20% reconsumption wallet / 10% tax deducted), same rounding.
   */
  async paySalaries(dto: PaySalaryDto, paidBy: string) {
    const month = this.assertMonth(dto.month);
    const minSales = Number(dto.minSales);
    const maxSales =
      dto.maxSales === undefined || dto.maxSales === null
        ? null
        : Number(dto.maxSales);
    this.assertTier(minSales, maxSales);
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

    const salesMap = new Map(
      (await this.getRewardSales(month)).map((r) => [r.userId, r]),
    );

    const notEligible = items.filter(
      (i) =>
        !inSalaryTier(
          salesMap.get(i.userId)?.weakSales ?? 0,
          minSales,
          maxSales,
        ),
    );
    if (notEligible.length > 0) {
      const tierText =
        maxSales === null ? `≥ ${minSales}` : `${minSales} – dưới ${maxSales}`;
      const names = notEligible
        .slice(0, 10)
        .map((i) => salesMap.get(i.userId)?.username || i.userId)
        .join(', ');
      throw new BadRequestException(
        `${notEligible.length} user không đạt mốc doanh số tính thưởng ${tierText} trong tháng ${month}: ${names}`,
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
                rewardSales: salesMap.get(item.userId)!.weakSales,
                tierMin: minSales,
                tierMax: maxSales,
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
      `[ADMIN] salary month=${month} tier=${minSales}-${maxSales ?? '∞'} users=${items.length} total=${totalAmount} withdraw=${totalWithdrawAmount} reconsumption=${totalReconsumptionAmount} tax=${totalTaxAmount} USDT by=${paidBy}. Split: withdraw ${distribution.withdrawPercent}%, reconsumption ${distribution.reconsumptionPercent}%, tax ${distribution.taxPercent}%.`,
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
        rewardSales: p.rewardSales,
        tierMin: p.tierMin,
        tierMax: p.tierMax,
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
