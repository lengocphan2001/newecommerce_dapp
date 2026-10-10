import { OrderService } from './order.service';
import { Order, OrderStatus } from './entities/order.entity';
import { User } from '../user/entities/user.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';

const BUYER = { id: '11111111-1111-1111-1111-111111111111', username: 'buyer' };
const SPONSOR = { id: '22222222-2222-2222-2222-222222222222', username: 'sponsor' };

/**
 * OrderService with only what deleteOrderAndRollback touches: the order lookup,
 * a transaction over in-memory repos, and the stock / rollback steps stubbed.
 */
function setup(order: Partial<Order>, opts: { rollbackFails?: boolean } = {}) {
  const fullOrder = {
    id: 'order-1',
    userId: BUYER.id,
    status: OrderStatus.CONFIRMED,
    totalAmount: 100,
    notes: null,
    paidByUserId: null,
    paidFromReconsumptionAmount: null,
    ...order,
  } as unknown as Order;

  const users = [BUYER, SPONSOR];
  const increments: Array<{ userId: string; wallet: string; amount: number }> = [];
  const audits: any[] = [];
  const removed: Order[] = [];
  const pending: Array<() => void> = [];

  const matches = (u: any, where: any) =>
    Object.entries(where).every(([k, v]) => u[k] === v);
  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const conditions = Array.isArray(where) ? where : [where];
      return users.find((u) => conditions.some((c) => matches(u, c))) ?? null;
    }),
    // Only applied when the transaction commits
    increment: jest.fn(async (where: any, wallet: string, amount: number) => {
      pending.push(() => increments.push({ userId: where.id, wallet, amount }));
    }),
  };
  const auditRepo = {
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => {
      pending.push(() => audits.push(v));
      return v;
    }),
  };
  const orderRepo = {
    remove: jest.fn(async (o: Order) => {
      pending.push(() => removed.push(o));
    }),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === User ? userRepo : entity === AuditLog ? auditRepo : orderRepo,
  };

  const service = Object.create(OrderService.prototype) as OrderService;
  Object.assign(service, {
    dataSource: {
      transaction: async (work: (m: any) => Promise<void>) => {
        await work(manager);
        pending.forEach((apply) => apply());
      },
    },
  });
  jest.spyOn(service, 'findOne').mockResolvedValue(fullOrder);
  jest.spyOn(service as any, 'updateStockByOrderItems').mockResolvedValue(undefined);
  jest.spyOn(service, 'rollbackOrderEffects').mockImplementation(async () => {
    if (opts.rollbackFails) throw new Error('rollback failed');
  });

  return { service, increments, audits, removed };
}

describe('OrderService.deleteOrderAndRollback wallet refund', () => {
  it('refunds a bonus wallet order to the bonus wallet of the buyer', async () => {
    const { service, increments, audits, removed } = setup({
      paymentMethod: 'withdraw_wallet',
      paidByUserId: BUYER.id,
    });

    const refund = await service.deleteOrderAndRollback('order-1', 'admin-1');

    expect(increments).toEqual([
      { userId: BUYER.id, wallet: 'withdrawWalletBalance', amount: 100 },
    ]);
    expect(refund).toEqual({
      userId: BUYER.id,
      username: 'buyer',
      credits: [{ wallet: 'withdrawWalletBalance', amount: 100 }],
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].userId).toBe('admin-1');
    expect(removed).toHaveLength(1);
  });

  it('refunds the sponsor, not the buyer, on a proxy order', async () => {
    const { service, increments } = setup({
      paymentMethod: 'withdraw_wallet',
      paidByUserId: SPONSOR.id,
    });

    await service.deleteOrderAndRollback('order-1');

    expect(increments).toEqual([
      { userId: SPONSOR.id, wallet: 'withdrawWalletBalance', amount: 100 },
    ]);
  });

  it('finds the sponsor of an older proxy order from its note', async () => {
    const { service, increments } = setup({
      paymentMethod: 'withdraw_wallet',
      notes: 'Giao giờ hành chính | Mua hộ bởi @sponsor',
    });

    await service.deleteOrderAndRollback('order-1');

    expect(increments).toEqual([
      { userId: SPONSOR.id, wallet: 'withdrawWalletBalance', amount: 100 },
    ]);
  });

  it('refunds a PV wallet order to the PV wallet', async () => {
    const { service, increments } = setup({ paymentMethod: 'pv_wallet' });

    await service.deleteOrderAndRollback('order-1');

    expect(increments).toEqual([
      { userId: BUYER.id, wallet: 'pvWalletBalance', amount: 100 },
    ]);
  });

  it('splits a consumption wallet refund the way it was paid', async () => {
    const { service, increments } = setup({
      paymentMethod: 'deposit_wallet',
      paidFromReconsumptionAmount: 30,
    });

    await service.deleteOrderAndRollback('order-1');

    expect(increments).toEqual([
      { userId: BUYER.id, wallet: 'reconsumptionWalletBalance', amount: 30 },
      { userId: BUYER.id, wallet: 'walletBalance', amount: 70 },
    ]);
  });

  it('puts an older consumption wallet payment back into the commission part', async () => {
    const { service, increments } = setup({ paymentMethod: 'deposit_wallet' });

    await service.deleteOrderAndRollback('order-1');

    expect(increments).toEqual([
      { userId: BUYER.id, wallet: 'reconsumptionWalletBalance', amount: 100 },
    ]);
  });

  it('also refunds a cancelled wallet order, since cancelling does not refund', async () => {
    const { service, increments } = setup({
      paymentMethod: 'withdraw_wallet',
      status: OrderStatus.CANCELLED,
    });

    await service.deleteOrderAndRollback('order-1');

    expect(increments).toHaveLength(1);
  });

  it('does not refund orders paid by banking or USDT', async () => {
    for (const paymentMethod of ['banking', 'usdt', 'wallet', 'cod']) {
      const { service, increments, removed } = setup({ paymentMethod });
      await expect(service.deleteOrderAndRollback('order-1')).resolves.toBeNull();
      expect(increments).toEqual([]);
      expect(removed).toHaveLength(1);
    }
  });

  it('keeps the order and wallets untouched when the rollback fails', async () => {
    const { service, increments, removed } = setup(
      { paymentMethod: 'withdraw_wallet' },
      { rollbackFails: true },
    );

    await expect(service.deleteOrderAndRollback('order-1')).rejects.toThrow('rollback failed');
    expect(increments).toEqual([]);
    expect(removed).toEqual([]);
  });

  it('refuses to delete when the payer cannot be found', async () => {
    const { service, increments, removed } = setup({
      paymentMethod: 'withdraw_wallet',
      notes: 'Mua hộ bởi @ghost',
    });

    await expect(service.deleteOrderAndRollback('order-1')).rejects.toThrow(
      'Không tìm thấy người đã trả tiền',
    );
    expect(increments).toEqual([]);
    expect(removed).toEqual([]);
  });
});
