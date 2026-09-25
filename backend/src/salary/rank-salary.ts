/**
 * Monthly rank salary for C1 and C2 agents, shared out of two pools built from
 * the previous month's reward sales ("doanh số tính thưởng", weak binary branch
 * sales) of the agents in each pool:
 *
 * - Pool C1: 4% of the combined reward sales of every C1 and C2 agent, shared
 *   equally among all of them (a C2 agent also sits in the C1 pool).
 * - Pool C2: 2% of the combined reward sales of the C2 agents, shared equally
 *   among the C2 agents only.
 *
 * A C2 agent is therefore paid one share of each pool.
 */
export interface RankSalaryPool {
  code: 'C1' | 'C2';
  label: string;
  /** Agent ranks that are members of the pool. */
  ranks: readonly string[];
  rate: number;
}

export const RANK_SALARY_POOLS: readonly RankSalaryPool[] = [
  { code: 'C1', label: 'Bể C1 (C1 + C2)', ranks: ['C1', 'C2'], rate: 0.04 },
  { code: 'C2', label: 'Bể C2', ranks: ['C2'], rate: 0.02 },
];

/** Ranks paid a rank salary. */
export const RANK_SALARY_RANKS: readonly string[] = ['C1', 'C2'];

export interface RankSalaryMember {
  userId: string;
  rank: string;
  rewardSales: number;
}

/** Rounded down to 4 decimals so the shares never add up to more than the pool. */
function floorAmount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n * 1e4 + 1e-6) / 1e4;
}

/**
 * Pool totals and each member's shares. Members whose rank is not paid a rank
 * salary are ignored.
 */
export function computeRankSalaries<T extends RankSalaryMember>(members: T[]) {
  const eligible = members.filter((m) => RANK_SALARY_RANKS.includes(m.rank));

  const pools = RANK_SALARY_POOLS.map((pool) => {
    const poolMembers = eligible.filter((m) => pool.ranks.includes(m.rank));
    const sales = poolMembers.reduce(
      (s, m) => s + (Number(m.rewardSales) || 0),
      0,
    );
    const poolAmount = floorAmount(sales * pool.rate);
    return {
      ...pool,
      memberCount: poolMembers.length,
      sales: Math.round(sales * 1e8) / 1e8,
      poolAmount,
      share: poolMembers.length
        ? floorAmount(poolAmount / poolMembers.length)
        : 0,
    };
  });

  const [c1Pool, c2Pool] = pools;
  const rows = eligible.map((m) => {
    const c1Share = c1Pool.ranks.includes(m.rank) ? c1Pool.share : 0;
    const c2Share = c2Pool.ranks.includes(m.rank) ? c2Pool.share : 0;
    return {
      ...m,
      c1Share,
      c2Share,
      amount: Number((c1Share + c2Share).toFixed(4)),
    };
  });

  return { pools, rows };
}
