import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { User } from '../user/entities/user.entity';
import { WalletSwap } from './entities/wallet-swap.entity';

const USER_ID = '11111111-1111-1111-1111-111111111111';

/**
 * WalletService with only what swapRewardToConsumption touches: the banking
 * rate and a transaction over an in-memory user row and swap list.
 */
function setup(user: { withdrawWalletBalance: number; reconsumptionWalletBalance: number } | null) {
  const row = user ? { id: USER_ID, ...user } : null;
  const swaps: any[] = [];
  const lockedWith: string[] = [];

  const userRepo = {
    createQueryBuilder: () => {
      const qb: any = {
        select: () => qb,
        where: () => qb,
        setLock: (mode: string) => {
          lockedWith.push(mode);
          return qb;
        },
        getOne: async () => (row ? { ...row } : null),
      };
      return qb;
    },
    update: jest.fn(async (_id: string, patch: any) => {
      Object.assign(row!, patch);
    }),
  };
  const swapRepo = {
    create: (v: any) => v,
    save: jest.fn(async (v: any) => {
      swaps.push(v);
      return { id: 'swap-1', ...v };
    }),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === User ? userRepo : entity === WalletSwap ? swapRepo : null,
  };

  const service = Object.create(WalletService.prototype) as WalletService;
  Object.assign(service, {
    logger: { log: jest.fn() },
    bankingConfigRepo: {
      findOne: jest.fn(async () => ({ usdtWithdrawPriceVnd: 25000 })),
    },
    dataSource: {
      transaction: async (work: (m: any) => Promise<unknown>) => work(manager),
    },
  });

  return { service, row, swaps, lockedWith };
}

describe('WalletService.swapRewardToConsumption', () => {
  it('moves the amount from the reward wallet to the consumption wallet', async () => {
    const { service, row, swaps, lockedWith } = setup({
      withdrawWalletBalance: 100,
      reconsumptionWalletBalance: 5,
    });

    const swap = await service.swapRewardToConsumption(USER_ID, 40);

    expect(row).toMatchObject({ withdrawWalletBalance: 60, reconsumptionWalletBalance: 45 });
    expect(swaps).toEqual([
      { userId: USER_ID, amount: 40, rate: 25000, amountVnd: 1000000 },
    ]);
    expect(swap.id).toBe('swap-1');
    expect(lockedWith).toEqual(['pessimistic_write']);
  });

  it('moves the whole balance when Max sends a float just above it', async () => {
    const { service, row, swaps } = setup({
      withdrawWalletBalance: 12.3456789,
      reconsumptionWalletBalance: 0,
    });

    await service.swapRewardToConsumption(USER_ID, 12.3456789 + 1e-12);

    expect(row!.withdrawWalletBalance).toBe(0);
    expect(row!.reconsumptionWalletBalance).toBeCloseTo(12.3456789, 9);
    expect(swaps[0].amount).toBe(12.3456789);
  });

  it('refuses more than the reward wallet holds and changes nothing', async () => {
    const { service, row, swaps } = setup({
      withdrawWalletBalance: 10,
      reconsumptionWalletBalance: 0,
    });

    await expect(service.swapRewardToConsumption(USER_ID, 10.5)).rejects.toThrow(
      BadRequestException,
    );
    expect(row).toMatchObject({ withdrawWalletBalance: 10, reconsumptionWalletBalance: 0 });
    expect(swaps).toEqual([]);
  });

  it('refuses a zero or negative amount', async () => {
    const { service } = setup({ withdrawWalletBalance: 10, reconsumptionWalletBalance: 0 });

    await expect(service.swapRewardToConsumption(USER_ID, 0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.swapRewardToConsumption(USER_ID, -5)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('fails for an unknown user', async () => {
    const { service } = setup(null);

    await expect(service.swapRewardToConsumption(USER_ID, 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});
