/**
 * Monthly agent ranks (`users.manualRank`, `user_monthly_stats.calculatedRank`)
 * and the reward rates tied to them.
 *
 * Everything that validates, orders, or explains a rank must read from here so
 * the admin panel and the monthly calculation cannot drift apart.
 */

/** Rank order, lowest to highest. C0 = unranked, DAILY = Đại lý. */
export const MONTHLY_RANK_ORDER = [
  'C0',
  'DAILY',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
];

/**
 * Values accepted for a manually assigned rank. `NONE` means "not assigned",
 * so the monthly calculation derives the rank instead. C0 is never assigned by
 * hand — it is what an unqualified user computes to.
 */
export const MANUAL_RANK_VALUES = [
  'NONE',
  ...MONTHLY_RANK_ORDER.filter((rank) => rank !== 'C0'),
];

/** Lifetime purchase total (USD) required to count as Đại lý. */
export const DAILY_RANK_MIN_PURCHASE = 600;

/** F1 count required at a minimum rank to reach each rank. All entries must hold. */
export const MONTHLY_RANK_RULES: Record<
  string,
  { rank: string; count: number }[]
> = {
  C1: [{ rank: 'DAILY', count: 3 }],
  C2: [{ rank: 'C1', count: 3 }],
  C3: [{ rank: 'C2', count: 3 }],
  C4: [{ rank: 'C3', count: 3 }],
  C5: [{ rank: 'C4', count: 3 }],
  C6: [
    { rank: 'C5', count: 2 },
    { rank: 'C4', count: 3 },
  ],
  C7: [
    { rank: 'C6', count: 2 },
    { rank: 'C5', count: 3 },
  ],
  C8: [
    { rank: 'C7', count: 2 },
    { rank: 'C6', count: 3 },
  ],
  C9: [{ rank: 'C7', count: 3 }],
};

/** Promotion is evaluated in this order, lowest rank first. */
export const MONTHLY_RANK_PROMOTION_ORDER = [
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
];

/** Upper bound on promotion passes, in case the referral tree is malformed. */
export const MONTHLY_RANK_PROMOTION_LOOP_LIMIT = 50;

/** Group sales thresholds and their group reward rate (Tầng 3), highest first. */
export const GROUP_REWARD_TIERS = [
  { min: 40000, rate: 0.1, label: 'Mốc 4: > $40,000' },
  { min: 20000, rate: 0.08, label: 'Mốc 3: $20,000 - $40,000' },
  { min: 4000, rate: 0.06, label: 'Mốc 2: $4,000 - $20,000' },
  { min: 400, rate: 0.04, label: 'Mốc 1: $400 - $4,000' },
];

/** National pool share per rank (Tầng 4). */
export const GLOBAL_SHARE_RATES: Record<string, number> = {
  C1: 0.04,
  C2: 0.02,
  C3: 0.01,
  C4: 0.005,
  C5: 0.005,
  C6: 0.005,
  C7: 0.005,
  C8: 0.005,
  C9: 0.005,
};

/** Display label for a rank. */
export function rankLabel(rank: string): string {
  if (rank === 'DAILY') return 'Đại lý';
  if (!rank || rank === 'C0') return 'Chưa xếp hạng';
  return rank;
}
