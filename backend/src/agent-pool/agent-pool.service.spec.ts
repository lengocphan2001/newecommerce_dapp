import { AgentPoolService } from './agent-pool.service';

describe('AgentPoolService', () => {
  it('should calculate pool reward in USD and only convert to VND at display time', () => {
    const orderNetUsd = 54;
    const poolPercent = 4;
    const memberCount = 1;

    const reward = AgentPoolService.calculatePoolRewardUsd({
      orderNetUsd,
      poolPercent,
      memberCount,
    });

    expect(reward.poolTotalUsd).toBe(2.16);
    expect(reward.rewardPerMemberUsd).toBe(2.16);
  });

  it('should convert to VND only when formatting for display', () => {
    const reward = AgentPoolService.calculatePoolRewardVnd({
      orderNetUsd: 54,
      poolPercent: 4,
      memberCount: 1,
      rateVnd: 25000,
    });

    expect(reward.poolTotalVnd).toBe(54000);
    expect(reward.rewardPerMemberVnd).toBe(54000);
  });

  it('should split a reward into withdraw wallet, reconsumption wallet and tax', () => {
    const split = AgentPoolService.splitRewardUsd(2.16, {
      withdrawPercent: 70,
      reconsumptionPercent: 20,
      taxPercent: 10,
    });

    expect(split.withdrawAmount).toBe(1.512);
    expect(split.reconsumptionAmount).toBe(0.432);
    expect(split.taxAmount).toBe(0.216);
    expect(
      split.withdrawAmount + split.reconsumptionAmount + split.taxAmount,
    ).toBeCloseTo(2.16, 4);
  });

  it('should keep the three parts summing to the reward when rounding', () => {
    const reward = 0.0001;
    const split = AgentPoolService.splitRewardUsd(reward, {
      withdrawPercent: 70,
      reconsumptionPercent: 20,
      taxPercent: 10,
    });

    expect(
      Number(
        (
          split.withdrawAmount +
          split.reconsumptionAmount +
          split.taxAmount
        ).toFixed(4),
      ),
    ).toBe(reward);
  });
});
