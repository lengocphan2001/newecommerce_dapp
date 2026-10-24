import { RewardSummary, RewardSummaryGroup } from './reward-report.types';

/** Raw numbers come back as strings (Postgres numeric / bigint, MySQL decimal). */
export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Midnight (server time) of a YYYY-MM-DD day, `addDays` later. */
export function localDay(ymd: string, addDays = 0): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d + addDays);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Every day (YYYY-MM-DD) or month (YYYY-MM) bucket from `from` to `to`. */
export function bucketsBetween(
  from: string,
  to: string,
  groupBy: 'day' | 'month',
): string[] {
  const out: string[] = [];
  if (groupBy === 'month') {
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    while (y < ty || (y === ty && m <= tm)) {
      out.push(`${y}-${pad(m)}`);
      if (++m > 12) {
        m = 1;
        y++;
      }
    }
    return out;
  }
  const end = localDay(to);
  for (let d = localDay(from); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return out;
}

export interface SummaryRow {
  source: string;
  sub_type: string | null;
  status: string;
  amount: unknown;
  withdraw_amount: unknown;
  reconsumption_amount: unknown;
  tax_amount: unknown;
  cnt: unknown;
}

export interface UsersRow {
  source?: string;
  sub_type?: string | null;
  users: unknown;
}

const emptyGroup = (): RewardSummaryGroup => ({
  amount: 0,
  withdrawAmount: 0,
  reconsumptionAmount: 0,
  taxAmount: 0,
  count: 0,
  users: 0,
  byStatus: {},
});

function add(group: RewardSummaryGroup, row: SummaryRow) {
  const amount = num(row.amount);
  const count = num(row.cnt);
  group.amount += amount;
  group.withdrawAmount += num(row.withdraw_amount);
  group.reconsumptionAmount += num(row.reconsumption_amount);
  group.taxAmount += num(row.tax_amount);
  group.count += count;
  const s = (group.byStatus[row.status] ??= { amount: 0, count: 0 });
  s.amount += amount;
  s.count += count;
}

/**
 * Fold the per (source, sub type, status) sums into totals, per source and
 * per sub type. Distinct user counts cannot be added up, so they come from
 * their own queries.
 */
export function assembleSummary(
  from: string,
  to: string,
  sourceOrder: string[],
  rows: SummaryRow[],
  usersBySubType: UsersRow[],
  usersBySource: UsersRow[],
  totalUsers: number,
): RewardSummary {
  const key = (source: string, subType: string | null) => `${source}\u0000${subType ?? ''}`;
  const subTypeUsers = new Map(
    usersBySubType.map((r) => [key(r.source!, r.sub_type ?? null), num(r.users)]),
  );
  const sourceUsers = new Map(usersBySource.map((r) => [r.source!, num(r.users)]));

  const totals = emptyGroup();
  totals.users = totalUsers;
  const sources = new Map<string, RewardSummary['sources'][number]>();
  for (const source of sourceOrder) {
    sources.set(source, {
      source,
      ...emptyGroup(),
      users: sourceUsers.get(source) ?? 0,
      subTypes: [],
    });
  }

  for (const row of rows) {
    const subType = row.sub_type ?? null;
    const src = sources.get(row.source);
    if (!src) continue;
    let sub = src.subTypes.find((s) => s.subType === subType);
    if (!sub) {
      sub = {
        subType,
        ...emptyGroup(),
        users: subTypeUsers.get(key(row.source, subType)) ?? 0,
      };
      src.subTypes.push(sub);
    }
    add(sub, row);
    add(src, row);
    add(totals, row);
  }

  for (const src of sources.values()) {
    src.subTypes.sort((a, b) => b.amount - a.amount);
  }

  return { from, to, totals, sources: [...sources.values()] };
}
