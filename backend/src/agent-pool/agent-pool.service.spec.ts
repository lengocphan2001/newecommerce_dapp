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
});
