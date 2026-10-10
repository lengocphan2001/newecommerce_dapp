import { OrderService } from './order.service';
import { User } from '../user/entities/user.entity';
import { HeapRewardHistory } from '../heap-reward/entities/heap-reward-history.entity';
import { HeapRewardPlacement } from '../heap-reward/entities/heap-reward-placement.entity';
import { AgentPoolHistory } from '../agent-pool/entities/agent-pool-history.entity';
import { AgentPoolMember } from '../agent-pool/entities/agent-pool-member.entity';

/** In-memory repo over `rows`, with the TypeORM calls the rollback helpers use. */
function memoryRepo(rows: any[]) {
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]) => row[k] === v);
  return {
    rows,
    find: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where))),
    findOne: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
    count: jest.fn(async ({ where }: any) => rows.filter((r) => matches(r, where)).length),
    save: jest.fn(async (row: any) => row),
    remove: jest.fn(async (removed: any[]) => {
      for (const r of removed) rows.splice(rows.indexOf(r), 1);
    }),
    decrement: jest.fn(async (where: any, column: string, amount: number) => {
      for (const r of rows.filter((x) => matches(x, where))) r[column] -= amount;
    }),
  };
}

function setup(data: {
  heapHistories?: any[];
  placements?: any[];
  agentHistories?: any[];
  members?: any[];
}) {
  const users = [
    { id: 'u1', withdrawWalletBalance: 100, reconsumptionWalletBalance: 50 },
    { id: 'u2', withdrawWalletBalance: 100, reconsumptionWalletBalance: 50 },
  ];
  const repos = new Map<unknown, ReturnType<typeof memoryRepo>>([
    [User, memoryRepo(users)],
    [HeapRewardHistory, memoryRepo(data.heapHistories ?? [])],
    [HeapRewardPlacement, memoryRepo(data.placements ?? [])],
    [AgentPoolHistory, memoryRepo(data.agentHistories ?? [])],
    [AgentPoolMember, memoryRepo(data.members ?? [])],
  ]);
  const manager = { getRepository: (entity: unknown) => repos.get(entity) };
  const service = Object.create(OrderService.prototype) as any;
  const user = (id: string) => users.find((u) => u.id === id)!;
  return { service, manager, repos, user };
}

describe('OrderService rollback of rewards paid out from an order', () => {
  it('takes back heap rewards the order paid to other pool members', async () => {
    const placement = { id: 'p1', userId: 'u1', poolLevel: 500, totalRewarded: 60, isActive: true, timesEntered: 0 };
    const { service, manager, repos, user } = setup({
      placements: [placement],
      heapHistories: [
        { id: 'h1', orderId: 'order-1', userId: 'u1', placementId: 'p1', amount: 20, pushedOut: false, walletCredited: true },
        { id: 'h2', orderId: 'order-2', userId: 'u1', placementId: 'p1', amount: 40, pushedOut: false, walletCredited: true },
      ],
    });

    await service.rollbackHeapRewardsOfOrder('order-1', manager);

    expect(user('u1').withdrawWalletBalance).toBe(80);
    expect(placement.totalRewarded).toBe(40);
    expect(repos.get(HeapRewardHistory)!.rows.map((h) => h.id)).toEqual(['h2']);
  });

  it('puts a placement back in the pool when this reward pushed it out', async () => {
    const placement = { id: 'p1', userId: 'u1', poolLevel: 500, totalRewarded: 1000, isActive: false, timesEntered: 1 };
    const { service, manager } = setup({
      placements: [placement],
      heapHistories: [
        { id: 'h1', orderId: 'order-1', userId: 'u1', placementId: 'p1', amount: 50, pushedOut: true, walletCredited: true },
      ],
    });

    await service.rollbackHeapRewardsOfOrder('order-1', manager);

    expect(placement).toMatchObject({ isActive: true, timesEntered: 0, totalRewarded: 950 });
  });

  it('keeps the old placement out when the user has re-entered the pool', async () => {
    const old = { id: 'p1', userId: 'u1', poolLevel: 500, totalRewarded: 1000, isActive: false, timesEntered: 1 };
    const current = { id: 'p2', userId: 'u1', poolLevel: 500, totalRewarded: 0, isActive: true, timesEntered: 1 };
    const { service, manager } = setup({
      placements: [old, current],
      heapHistories: [
        { id: 'h1', orderId: 'order-1', userId: 'u1', placementId: 'p1', amount: 50, pushedOut: true, walletCredited: true },
      ],
    });

    await service.rollbackHeapRewardsOfOrder('order-1', manager);

    expect(old).toMatchObject({ isActive: false, timesEntered: 1, totalRewarded: 950 });
  });

  it('does not touch the wallet for simulated heap rewards that were never credited', async () => {
    const { service, manager, user } = setup({
      placements: [{ id: 'p1', userId: 'u1', poolLevel: 500, totalRewarded: 20, isActive: true, timesEntered: 0 }],
      heapHistories: [
        { id: 'h1', orderId: 'order-1', userId: 'u1', placementId: 'p1', amount: 20, pushedOut: false, walletCredited: false },
      ],
    });

    await service.rollbackHeapRewardsOfOrder('order-1', manager);

    expect(user('u1').withdrawWalletBalance).toBe(100);
  });

  it('takes back agent pool rewards from the wallets they were split into', async () => {
    const member = { id: 'm1', totalRewarded: 30 };
    const { service, manager, repos, user } = setup({
      members: [member],
      agentHistories: [
        { id: 'a1', orderId: 'order-1', userId: 'u1', memberId: 'm1', rewardAmount: 10, withdrawAmount: 7, reconsumptionAmount: 2 },
        { id: 'a2', orderId: 'order-1', userId: 'u2', memberId: null, rewardAmount: 10, withdrawAmount: 7, reconsumptionAmount: 2 },
        { id: 'a3', orderId: 'order-2', userId: 'u1', memberId: 'm1', rewardAmount: 10, withdrawAmount: 7, reconsumptionAmount: 2 },
      ],
    });

    await service.rollbackAgentPoolRewardsOfOrder('order-1', manager);

    expect(user('u1')).toMatchObject({ withdrawWalletBalance: 93, reconsumptionWalletBalance: 48 });
    expect(user('u2')).toMatchObject({ withdrawWalletBalance: 93, reconsumptionWalletBalance: 48 });
    expect(member.totalRewarded).toBe(20);
    expect(repos.get(AgentPoolHistory)!.rows.map((h) => h.id)).toEqual(['a3']);
  });
});
