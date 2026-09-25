import {
  AgentPoolService,
  WalletDistribution,
} from '../agent-pool/agent-pool.service';
import { salaryPayableFrom } from './salary.service';
import {
  computeSalary,
  rewardSalesToVnd,
  salaryTierForVnd,
} from './salary-tiers';

describe('salaryPayableFrom', () => {
  it('opens on the 10th of the following month', () => {
    const d = salaryPayableFrom('2026-08');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([
      2026, 9, 10,
    ]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it('rolls December over to January of the next year', () => {
    const d = salaryPayableFrom('2026-12');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([
      2027, 1, 10,
    ]);
  });
});

describe('salaryTierForVnd', () => {
  const tierAt = (vnd: number) => salaryTierForVnd(vnd)?.code ?? null;

  it('pays nothing below 10 million VND', () => {
    expect(tierAt(0)).toBeNull();
    expect(tierAt(9_999_999)).toBeNull();
  });

  it('includes each lower bound and excludes each upper bound', () => {
    expect(tierAt(10_000_000)).toBe('T1');
    expect(tierAt(99_999_999)).toBe('T1');
    expect(tierAt(100_000_000)).toBe('T2');
    expect(tierAt(499_999_999)).toBe('T2');
    expect(tierAt(500_000_000)).toBe('T3');
    expect(tierAt(999_999_999)).toBe('T3');
    expect(tierAt(1_000_000_000)).toBe('T4');
    expect(tierAt(50_000_000_000)).toBe('T4');
  });

  it('uses 4%, 6%, 8% and 10%', () => {
    expect(salaryTierForVnd(10_000_000)?.rate).toBe(0.04);
    expect(salaryTierForVnd(100_000_000)?.rate).toBe(0.06);
    expect(salaryTierForVnd(500_000_000)?.rate).toBe(0.08);
    expect(salaryTierForVnd(1_000_000_000)?.rate).toBe(0.1);
  });
});

describe('computeSalary', () => {
  it('converts USD reward sales with the configured rate', () => {
    expect(rewardSalesToVnd(400, 25000)).toBe(10_000_000);
    expect(computeSalary(399.99, 25000).tier).toBeNull();
    expect(computeSalary(400, 25000).tier?.code).toBe('T1');
    // Same sales, different rate: the tier follows Banking Settings.
    expect(computeSalary(4000, 25000).tier?.code).toBe('T2');
    expect(computeSalary(4000, 24000).tier?.code).toBe('T1');
  });

  it('applies the tier rate to the whole month, not progressively', () => {
    // 8,000 USD * 25,000 = 200 million VND, tier 2 (6%).
    expect(computeSalary(8000, 25000)).toEqual(
      expect.objectContaining({ rewardSalesVnd: 200_000_000, amount: 480 }),
    );
    expect(computeSalary(50000, 25000).amount).toBe(5000);
  });

  it('pays zero below the lowest tier', () => {
    expect(computeSalary(100, 25000)).toEqual({
      tier: null,
      rewardSalesVnd: 2_500_000,
      amount: 0,
    });
  });

  it('rounds the salary to 4 decimals', () => {
    expect(computeSalary(1234.56789, 25000).amount).toBe(49.3827);
  });
});

describe('salary wallet split (shared with agent pool)', () => {
  const defaultDistribution: WalletDistribution = {
    withdrawPercent: 70,
    reconsumptionPercent: 20,
    taxPercent: 10,
  };

  it('splits 70% withdraw, 20% reconsumption, 10% tax by default', () => {
    expect(AgentPoolService.splitRewardUsd(100, defaultDistribution)).toEqual({
      withdrawAmount: 70,
      reconsumptionAmount: 20,
      taxAmount: 10,
    });
  });

  it('lets tax absorb rounding so the parts add up to the salary', () => {
    const amount = 33.33335;
    const { withdrawAmount, reconsumptionAmount, taxAmount } =
      AgentPoolService.splitRewardUsd(amount, defaultDistribution);
    expect(withdrawAmount + reconsumptionAmount + taxAmount).toBeCloseTo(
      amount,
      4,
    );
  });
});
