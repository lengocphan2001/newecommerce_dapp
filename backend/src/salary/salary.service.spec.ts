import {
  AgentPoolService,
  WalletDistribution,
} from '../agent-pool/agent-pool.service';
import { salaryPayableFrom } from './salary.service';

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
