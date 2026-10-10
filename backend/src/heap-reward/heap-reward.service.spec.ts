import { HeapRewardService, heapPoolsForAmount } from './heap-reward.service';

const USER = 'user-1';

/** Service over in-memory repos; `existing` lists the pools the user already had. */
function setup(opts: { orderTotal: number; purchaseTotal: number; existing?: number[] }) {
  const created: Array<{ poolLevel: number; triggerOrderId: string | null; timesEntered: number }> = [];
  const existing = opts.existing ?? [];
  const placementRepo = {
    count: jest.fn(async ({ where }: any) =>
      existing.filter((p) => p === where.poolLevel).length +
      created.filter((c) => c.poolLevel === where.poolLevel).length,
    ),
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => {
      created.push(v);
      return v;
    }),
  };
  const orderRepo = {
    findOne: jest.fn(async () => ({ id: 'order-1', userId: USER, totalAmount: opts.orderTotal })),
  };
  const userRepo = {
    findOne: jest.fn(async () => ({ id: USER, totalPurchaseAmount: opts.purchaseTotal })),
  };
  const configRepo = { findOne: jest.fn(async () => null) };
  const service = new HeapRewardService(
    placementRepo as any,
    {} as any,
    userRepo as any,
    orderRepo as any,
    {} as any,
    configRepo as any,
  );
  const distribute = jest
    .spyOn(service, 'distributeInstantPayoutForPool')
    .mockResolvedValue(undefined);
  return { service, created, distribute };
}

describe('heapPoolsForAmount', () => {
  it('maps amounts to pools', () => {
    expect(heapPoolsForAmount(99)).toEqual([]);
    expect(heapPoolsForAmount(100)).toEqual([100]);
    expect(heapPoolsForAmount(500)).toEqual([100, 500]);
    expect(heapPoolsForAmount(2399)).toEqual([100, 500]);
    expect(heapPoolsForAmount(2400)).toEqual([100, 500, 2400]);
  });
});

describe('HeapRewardService.processOrderIfEligible', () => {
  it('joins pools by purchase total even when the order is below 100', async () => {
    const { service, created, distribute } = setup({ orderTotal: 50, purchaseTotal: 650 });
    await service.processOrderIfEligible('order-1');
    expect(distribute).not.toHaveBeenCalled();
    expect(created.map((c) => c.poolLevel)).toEqual([100, 500]);
    expect(created.every((c) => c.triggerOrderId === 'order-1' && c.timesEntered === 0)).toBe(true);
  });

  it('puts a 500-2400 order in pools 100 and 500, paying pool 500 only', async () => {
    const { service, created, distribute } = setup({ orderTotal: 600, purchaseTotal: 600 });
    await service.processOrderIfEligible('order-1');
    expect(distribute).toHaveBeenCalledTimes(1);
    expect(distribute.mock.calls[0][0]).toBe(500);
    expect(created.map((c) => c.poolLevel)).toEqual([100, 500]);
  });

  it('only adds the pools the user never had', async () => {
    const { service, created } = setup({ orderTotal: 50, purchaseTotal: 3000, existing: [100] });
    await service.processOrderIfEligible('order-1');
    expect(created.map((c) => c.poolLevel)).toEqual([500, 2400]);
  });

  it('re-enters a pool only from an order of that level, without F1s', async () => {
    const small = setup({ orderTotal: 50, purchaseTotal: 700, existing: [100, 500] });
    await small.service.processOrderIfEligible('order-1');
    expect(small.created).toEqual([]);

    const big = setup({ orderTotal: 600, purchaseTotal: 1300, existing: [100, 500] });
    await big.service.processOrderIfEligible('order-1');
    expect(big.created.map((c) => [c.poolLevel, c.timesEntered])).toEqual([
      [100, 1],
      [500, 1],
    ]);
  });
});

describe('HeapRewardService.addPlacementsForManualRank', () => {
  it('adds pools 100 and 500 when missing, without a trigger order', async () => {
    const { service, created } = setup({ orderTotal: 0, purchaseTotal: 0, existing: [500] });
    await expect(service.addPlacementsForManualRank(USER)).resolves.toEqual([100]);
    expect(created).toEqual([
      expect.objectContaining({ poolLevel: 100, triggerOrderId: null, timesEntered: 0 }),
    ]);
  });
});
