import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import {
  RewardEntriesQueryDto,
  RewardReportQueryDto,
  RewardTimeseriesQueryDto,
  RewardTopUsersQueryDto,
} from './dto/reward-report-query.dto';
import {
  LedgerFilter,
  SqlDialect,
  SqlWriter,
  buildRewardLedger,
} from './reward-ledger.sql';
import {
  REWARD_SOURCES,
  RewardEntry,
  RewardSource,
  RewardSummary,
  RewardUserInfo,
} from './reward-report.types';
import {
  SummaryRow,
  UsersRow,
  assembleSummary,
  bucketsBetween,
  localDay,
  num,
} from './reward-report.util';

/** Daily charts beyond this many days are too dense to read; chart by month. */
const MAX_DAY_BUCKETS = 400;
/** A search matching more users than this should be narrowed down. */
const MAX_SEARCH_USERS = 1000;

/**
 * Reward report for the admin "Thống kê trả thưởng" page: every reward the
 * system grants a user (commissions, heap, matrix, agent pool, tier salary,
 * rank salary), read from the tables that record them and normalised into
 * one ledger.
 */
@Injectable()
export class RewardReportService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private get dialect(): SqlDialect {
    return this.dataSource.options.type === 'postgres' ? 'postgres' : 'mysql';
  }

  /** Run `wrap(ledger, where)` with the ledger's params. */
  private query<T>(
    filter: LedgerFilter,
    wrap: (ledger: string, where: string) => string,
  ): Promise<T[]> {
    const w = new SqlWriter(this.dialect);
    const { ledger, where } = buildRewardLedger(w, filter);
    return this.dataSource.query(wrap(ledger, where), w.params);
  }

  private async resolveFilter(q: RewardReportQueryDto): Promise<LedgerFilter> {
    if (q.from > q.to) {
      throw new BadRequestException('from must not be after to');
    }

    let userIds: string[] | undefined = q.userId ? [q.userId] : undefined;
    const search = q.search?.trim();
    if (search) {
      const found = await this.searchUserIds(search);
      userIds = userIds ? userIds.filter((id) => found.includes(id)) : found;
    }

    return {
      from: localDay(q.from),
      toExclusive: localDay(q.to, 1),
      fromMonth: q.from.slice(0, 7),
      toMonth: q.to.slice(0, 7),
      sources: (q.sources?.length ? q.sources : REWARD_SOURCES) as RewardSource[],
      subTypes: q.subTypes,
      statuses: q.statuses,
      userIds,
    };
  }

  private async searchUserIds(search: string): Promise<string[]> {
    const like = `%${search.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const users = await this.userRepository
      .createQueryBuilder('u')
      .select(['u.id'])
      .where(
        new Brackets((qb) =>
          qb
            .where('LOWER(u.username) LIKE :like', { like })
            .orWhere('LOWER(u.fullName) LIKE :like', { like })
            .orWhere('LOWER(u.email) LIKE :like', { like })
            .orWhere('u.phone LIKE :like', { like }),
        ),
      )
      .take(MAX_SEARCH_USERS + 1)
      .getMany();
    if (users.length > MAX_SEARCH_USERS) {
      throw new BadRequestException(
        `Search matches more than ${MAX_SEARCH_USERS} users, please narrow it down`,
      );
    }
    return users.map((u) => u.id);
  }

  private async loadUsers(ids: Array<string | null>): Promise<Map<string, RewardUserInfo>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (!unique.length) return new Map();
    const users = await this.userRepository.find({
      where: { id: In(unique) },
      select: ['id', 'username', 'fullName', 'email'],
    });
    return new Map(
      users.map((u) => [
        u.id,
        { id: u.id, username: u.username, fullName: u.fullName, email: u.email },
      ]),
    );
  }

  async getSummary(q: RewardReportQueryDto): Promise<RewardSummary> {
    const f = await this.resolveFilter(q);
    const sumCols = `SUM(u.amount) AS amount, SUM(u.withdraw_amount) AS withdraw_amount,
      SUM(u.reconsumption_amount) AS reconsumption_amount, SUM(u.tax_amount) AS tax_amount,
      COUNT(*) AS cnt`;

    const [rows, bySubType, bySource, total] = await Promise.all([
      this.query<SummaryRow>(
        f,
        (l, where) =>
          `SELECT u.source, u.sub_type, u.status, ${sumCols} FROM (${l}) u ${where}
           GROUP BY u.source, u.sub_type, u.status`,
      ),
      this.query<UsersRow>(
        f,
        (l, where) =>
          `SELECT u.source, u.sub_type, COUNT(DISTINCT u.user_id) AS users FROM (${l}) u ${where}
           GROUP BY u.source, u.sub_type`,
      ),
      this.query<UsersRow>(
        f,
        (l, where) =>
          `SELECT u.source, COUNT(DISTINCT u.user_id) AS users FROM (${l}) u ${where}
           GROUP BY u.source`,
      ),
      this.query<UsersRow>(
        f,
        (l, where) => `SELECT COUNT(DISTINCT u.user_id) AS users FROM (${l}) u ${where}`,
      ),
    ]);

    return assembleSummary(
      q.from,
      q.to,
      f.sources,
      rows,
      bySubType,
      bySource,
      num(total[0]?.users),
    );
  }

  async getTimeseries(q: RewardTimeseriesQueryDto) {
    const groupBy = q.groupBy ?? 'month';
    const buckets = bucketsBetween(q.from, q.to, groupBy);
    if (groupBy === 'day' && buckets.length > MAX_DAY_BUCKETS) {
      throw new BadRequestException(
        `Daily chart is limited to ${MAX_DAY_BUCKETS} days, group by month instead`,
      );
    }
    const f = await this.resolveFilter(q);
    const col = groupBy === 'day' ? 'u.day' : 'u.period';
    const rows = await this.query<{ bucket: string; source: string; amount: unknown; cnt: unknown }>(
      f,
      (l, where) =>
        `SELECT ${col} AS bucket, u.source, SUM(u.amount) AS amount, COUNT(*) AS cnt
         FROM (${l}) u ${where} GROUP BY ${col}, u.source`,
    );

    const series = new Map(
      buckets.map((bucket) => [
        bucket,
        { bucket, total: 0, count: 0, bySource: {} as Record<string, number> },
      ]),
    );
    for (const row of rows) {
      // Salaries of a month that starts before `from` chart on its first day.
      const point = series.get(row.bucket) ?? series.get(buckets[0]);
      if (!point) continue;
      const amount = num(row.amount);
      point.total += amount;
      point.count += num(row.cnt);
      point.bySource[row.source] = (point.bySource[row.source] ?? 0) + amount;
    }
    return { groupBy, sources: f.sources, points: [...series.values()] };
  }

  async getEntries(q: RewardEntriesQueryDto) {
    const f = await this.resolveFilter(q);
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const offset = (page - 1) * limit;

    const [rows, count] = await Promise.all([
      this.query<Record<string, any>>(
        f,
        (l, where) =>
          `SELECT u.* FROM (${l}) u ${where}
           ORDER BY u.occurred_at DESC, u.id DESC LIMIT ${limit} OFFSET ${offset}`,
      ),
      this.query<{ cnt: unknown }>(
        f,
        (l, where) => `SELECT COUNT(*) AS cnt FROM (${l}) u ${where}`,
      ),
    ]);

    const users = await this.loadUsers(
      rows.flatMap((r) => [r.user_id, r.from_user_id]),
    );
    const items: RewardEntry[] = rows.map((r) => ({
      source: r.source,
      subType: r.sub_type ?? null,
      id: r.id,
      userId: r.user_id,
      user: users.get(r.user_id) ?? null,
      fromUserId: r.from_user_id ?? null,
      fromUser: r.from_user_id ? (users.get(r.from_user_id) ?? null) : null,
      amount: num(r.amount),
      withdrawAmount: num(r.withdraw_amount),
      reconsumptionAmount: num(r.reconsumption_amount),
      taxAmount: num(r.tax_amount),
      status: r.status,
      refId: r.ref_id ?? null,
      occurredAt: new Date(r.occurred_at).toISOString(),
      period: r.period,
    }));

    return { items, total: num(count[0]?.cnt), page, limit };
  }

  async getTopUsers(q: RewardTopUsersQueryDto) {
    const f = await this.resolveFilter(q);
    const limit = q.limit ?? 20;
    // Source names are fixed enum values, safe to inline as aliases.
    const perSource = f.sources
      .map(
        (s) => `SUM(CASE WHEN u.source = '${s}' THEN u.amount ELSE 0 END) AS src_${s}`,
      )
      .join(', ');

    const rows = await this.query<Record<string, any>>(
      f,
      (l, where) =>
        `SELECT u.user_id, SUM(u.amount) AS amount, SUM(u.withdraw_amount) AS withdraw_amount,
           SUM(u.reconsumption_amount) AS reconsumption_amount, SUM(u.tax_amount) AS tax_amount,
           COUNT(*) AS cnt, ${perSource}
         FROM (${l}) u ${where}
         GROUP BY u.user_id ORDER BY amount DESC LIMIT ${limit}`,
    );

    const users = await this.loadUsers(rows.map((r) => r.user_id));
    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      user: users.get(r.user_id) ?? null,
      amount: num(r.amount),
      withdrawAmount: num(r.withdraw_amount),
      reconsumptionAmount: num(r.reconsumption_amount),
      taxAmount: num(r.tax_amount),
      count: num(r.cnt),
      bySource: Object.fromEntries(f.sources.map((s) => [s, num(r[`src_${s}`])])),
    }));
  }
}
