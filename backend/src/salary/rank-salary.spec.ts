import { computeRankSalaries } from './rank-salary';

describe('computeRankSalaries', () => {
  const member = (userId: string, rank: string, rewardSales: number) => ({
    userId,
    rank,
    rewardSales,
  });

  it('shares 4% of C1 + C2 sales among C1 and C2, and 2% of C2 sales among C2', () => {
    const { pools, rows } = computeRankSalaries([
      member('a', 'C1', 1000),
      member('b', 'C1', 3000),
      member('c', 'C2', 6000),
    ]);

    const [c1, c2] = pools;
    expect(c1).toEqual(
      expect.objectContaining({
        sales: 10000,
        poolAmount: 400,
        memberCount: 3,
      }),
    );
    expect(c1.share).toBe(133.3333);
    expect(c2).toEqual(
      expect.objectContaining({
        sales: 6000,
        poolAmount: 120,
        memberCount: 1,
        share: 120,
      }),
    );

    const byId = new Map(rows.map((r) => [r.userId, r]));
    expect(byId.get('a')).toEqual(
      expect.objectContaining({
        c1Share: 133.3333,
        c2Share: 0,
        amount: 133.3333,
      }),
    );
    expect(byId.get('c')).toEqual(
      expect.objectContaining({
        c1Share: 133.3333,
        c2Share: 120,
        amount: 253.3333,
      }),
    );
  });

  it('never pays out more than a pool', () => {
    const { pools } = computeRankSalaries(
      Array.from({ length: 7 }, (_, i) => member(String(i), 'C2', 100)),
    );
    for (const p of pools) {
      expect(p.share * p.memberCount).toBeLessThanOrEqual(p.poolAmount);
    }
  });

  it('ignores other ranks and handles empty pools', () => {
    const { pools, rows } = computeRankSalaries([
      member('x', 'C3', 5000),
      member('y', 'DAILY', 5000),
      member('z', 'C1', 0),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['z']);
    expect(rows[0].amount).toBe(0);
    expect(pools[1]).toEqual(
      expect.objectContaining({ memberCount: 0, poolAmount: 0, share: 0 }),
    );
  });
});
