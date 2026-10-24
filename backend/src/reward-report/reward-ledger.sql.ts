import { RewardSource } from './reward-report.types';

export type SqlDialect = 'postgres' | 'mysql';

export interface LedgerFilter {
  /** Rows created at or after this instant. */
  from: Date;
  /** Rows created strictly before this instant. */
  toExclusive: Date;
  /** Salary months, YYYY-MM, inclusive. */
  fromMonth: string;
  toMonth: string;
  sources: RewardSource[];
  subTypes?: string[];
  statuses?: string[];
  /** Restrict to these receiving users; an empty list matches nothing. */
  userIds?: string[];
}

/**
 * Collects positional parameters and writes the SQL fragments that differ
 * between PostgreSQL and MySQL, so one query text serves both.
 */
export class SqlWriter {
  readonly params: unknown[] = [];

  constructor(readonly dialect: SqlDialect) {}

  private get pg() {
    return this.dialect === 'postgres';
  }

  param(value: unknown): string {
    this.params.push(value);
    return this.pg ? `$${this.params.length}` : '?';
  }

  list(values: unknown[]): string {
    return values.map((v) => this.param(v)).join(', ');
  }

  col(alias: string, name: string): string {
    return this.pg ? `${alias}."${name}"` : `${alias}.\`${name}\``;
  }

  text(expr: string): string {
    return `CAST(${expr} AS ${this.pg ? 'TEXT' : 'CHAR'})`;
  }

  money(expr: string): string {
    return `CAST(${expr} AS DECIMAL(36,18))`;
  }

  month(expr: string): string {
    return this.pg
      ? `to_char(${expr}, 'YYYY-MM')`
      : `DATE_FORMAT(${expr}, '%Y-%m')`;
  }

  day(expr: string): string {
    return this.pg
      ? `to_char(${expr}, 'YYYY-MM-DD')`
      : `DATE_FORMAT(${expr}, '%Y-%m-%d')`;
  }
}

/** Normalised columns every branch of the ledger yields, in this order. */
interface Branch {
  table: string;
  joins?: string;
  sub_type: string;
  id: string;
  user_id: string;
  from_user_id: string;
  amount: string;
  withdraw_amount: string;
  reconsumption_amount: string;
  tax_amount: string;
  status: string;
  ref_id: string;
  occurred_at: string;
  /** YYYY-MM the row is reported under. */
  period: string;
  /** YYYY-MM-DD the row is charted under. */
  day: string;
  /** Range condition; salaries filter on their sales month. */
  range: string;
  userCol: string;
}

function branchFor(source: RewardSource, w: SqlWriter, f: LedgerFilter): Branch {
  const c = (name: string) => w.col('t', name);
  const nul = w.text('NULL');
  const byCreatedAt = () => ({
    occurred_at: c('createdAt'),
    period: w.month(c('createdAt')),
    day: w.day(c('createdAt')),
    range: `${c('createdAt')} >= ${w.param(f.from)} AND ${c('createdAt')} < ${w.param(f.toExclusive)}`,
  });
  const bySalesMonth = () => ({
    occurred_at: c('createdAt'),
    period: w.text(c('month')),
    day: `CONCAT(${c('month')}, '-01')`,
    range: `${c('month')} >= ${w.param(f.fromMonth)} AND ${c('month')} <= ${w.param(f.toMonth)}`,
  });
  const allToWithdraw = (amount: string) => ({
    amount: w.money(amount),
    withdraw_amount: w.money(amount),
    reconsumption_amount: w.money('0'),
    tax_amount: w.money('0'),
  });
  const ownSplit = (amount: string) => ({
    amount: w.money(amount),
    withdraw_amount: w.money(c('withdrawAmount')),
    reconsumption_amount: w.money(c('reconsumptionAmount')),
    tax_amount: w.money(c('taxAmount')),
  });
  const paid = w.text(`'paid'`);
  const common = { id: w.text(c('id')), user_id: w.text(c('userId')), userCol: c('userId') };

  switch (source) {
    case RewardSource.COMMISSION:
      return {
        table: 'commissions',
        ...common,
        sub_type: w.text(c('type')),
        from_user_id: w.text(c('fromUserId')),
        ...ownSplit(c('amount')),
        status: w.text(c('status')),
        ref_id: w.text(`COALESCE(${c('orderId')}, ${c('milestoneRef')})`),
        ...byCreatedAt(),
      };
    case RewardSource.HEAP:
      return {
        table: 'heap_reward_histories',
        ...common,
        sub_type: w.text(`CONCAT('pool_', ${c('poolLevel')})`),
        from_user_id: nul,
        ...allToWithdraw(c('amount')),
        status: paid,
        ref_id: w.text(c('placementId')),
        ...byCreatedAt(),
      };
    case RewardSource.MATRIX:
      return {
        table: 'matrix_reward_ledger',
        joins: `LEFT JOIN matrix_reward_trees tr ON ${w.text(w.col('tr', 'id'))} = ${w.text(c('treeId'))}`,
        ...common,
        user_id: w.text(c('beneficiaryUserId')),
        userCol: c('beneficiaryUserId'),
        sub_type: w.text(`CONCAT('tree_', ${w.col('tr', 'treeLevel')})`),
        from_user_id: nul,
        ...allToWithdraw(c('amount')),
        status: paid,
        ref_id: w.text(c('orderId')),
        ...byCreatedAt(),
      };
    case RewardSource.AGENT_POOL:
      return {
        table: 'agent_pool_histories',
        joins: `LEFT JOIN agent_pools ap ON ${w.text(w.col('ap', 'id'))} = ${w.text(c('poolId'))}`,
        ...common,
        sub_type: w.text(w.col('ap', 'code')),
        from_user_id: nul,
        ...ownSplit(c('rewardAmount')),
        status: paid,
        ref_id: w.text(c('orderId')),
        ...byCreatedAt(),
      };
    case RewardSource.SALARY:
      return {
        table: 'salary_payments',
        ...common,
        sub_type: w.text(c('tierCode')),
        from_user_id: nul,
        ...ownSplit(c('amount')),
        status: paid,
        ref_id: nul,
        ...bySalesMonth(),
      };
    case RewardSource.RANK_SALARY:
      return {
        table: 'rank_salary_payments',
        ...common,
        sub_type: w.text(c('rank')),
        from_user_id: nul,
        ...ownSplit(c('amount')),
        status: paid,
        ref_id: nul,
        ...bySalesMonth(),
      };
  }
}

const COLUMNS = [
  'sub_type',
  'id',
  'user_id',
  'from_user_id',
  'amount',
  'withdraw_amount',
  'reconsumption_amount',
  'tax_amount',
  'status',
  'ref_id',
  'occurred_at',
  'period',
  'day',
] as const;

/**
 * One `UNION ALL` over every reward table, with the same columns from each,
 * filtered by date and user inside each branch so the indexes are used.
 * Returns the derived-table SQL (to wrap as `FROM (...) u`) and the outer
 * WHERE clause for sub type and status. Params are appended to `w`.
 */
export function buildRewardLedger(
  w: SqlWriter,
  f: LedgerFilter,
): { ledger: string; where: string } {
  const branches = f.sources.map((source) => {
    const b = branchFor(source, w, f);
    const conds = [b.range];
    if (f.userIds) {
      conds.push(
        f.userIds.length ? `${b.userCol} IN (${w.list(f.userIds)})` : '1 = 0',
      );
    }
    const cols = [
      `${w.text(`'${source}'`)} AS source`,
      ...COLUMNS.map((name) => `${b[name]} AS ${name}`),
    ];
    return `SELECT ${cols.join(', ')} FROM ${b.table} t ${b.joins ?? ''} WHERE ${conds.join(' AND ')}`;
  });

  const outer: string[] = [];
  if (f.subTypes?.length) outer.push(`u.sub_type IN (${w.list(f.subTypes)})`);
  if (f.statuses?.length) outer.push(`u.status IN (${w.list(f.statuses)})`);

  return {
    ledger: branches.join(' UNION ALL '),
    where: outer.length ? `WHERE ${outer.join(' AND ')}` : '',
  };
}
