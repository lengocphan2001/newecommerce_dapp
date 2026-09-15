/**
 * Monthly salary tiers on a user's reward sales ("doanh số tính thưởng", the
 * weak binary branch sales) for the month, in VND. The salary is the whole
 * month's reward sales times the tier rate (not progressive).
 *
 * Reward sales are stored in USD, so they are converted with the USDT/VND rate
 * from Banking Settings (`banking_config.usdtPriceVnd`) before picking a tier.
 * A tier includes its lower bound and excludes its upper bound.
 */
export interface SalaryTier {
  code: string;
  label: string;
  minVnd: number;
  /** Exclusive upper bound, null for the top tier. */
  maxVnd: number | null;
  rate: number;
}

export const SALARY_TIERS: readonly SalaryTier[] = [
  {
    code: 'T1',
    label: 'Mốc 1: 10 triệu – dưới 100 triệu',
    minVnd: 10_000_000,
    maxVnd: 100_000_000,
    rate: 0.04,
  },
  {
    code: 'T2',
    label: 'Mốc 2: 100 triệu – dưới 500 triệu',
    minVnd: 100_000_000,
    maxVnd: 500_000_000,
    rate: 0.06,
  },
  {
    code: 'T3',
    label: 'Mốc 3: 500 triệu – dưới 1 tỷ',
    minVnd: 500_000_000,
    maxVnd: 1_000_000_000,
    rate: 0.08,
  },
  {
    code: 'T4',
    label: 'Mốc 4: từ 1 tỷ',
    minVnd: 1_000_000_000,
    maxVnd: null,
    rate: 0.1,
  },
];

/** USD reward sales in VND, rounded to the dong so float noise can't cross a bound. */
export function rewardSalesToVnd(rewardSalesUsd: number, vndRate: number): number {
  const vnd = (Number(rewardSalesUsd) || 0) * vndRate;
  return Number.isFinite(vnd) ? Math.round(vnd) : 0;
}

/** Salary tier for reward sales in VND, or null below the lowest tier. */
export function salaryTierForVnd(rewardSalesVnd: number): SalaryTier | null {
  return (
    SALARY_TIERS.find(
      (t) =>
        rewardSalesVnd >= t.minVnd &&
        (t.maxVnd === null || rewardSalesVnd < t.maxVnd),
    ) ?? null
  );
}

/**
 * Salary for a month's reward sales (USD) at a USDT/VND rate: the tier and the
 * gross salary in USDT, rounded to 4 decimals like the wallet split.
 */
export function computeSalary(rewardSalesUsd: number, vndRate: number) {
  const rewardSalesVnd = rewardSalesToVnd(rewardSalesUsd, vndRate);
  const tier = salaryTierForVnd(rewardSalesVnd);
  const amount = tier
    ? Number(((Number(rewardSalesUsd) || 0) * tier.rate).toFixed(4))
    : 0;
  return { tier, rewardSalesVnd, amount };
}
