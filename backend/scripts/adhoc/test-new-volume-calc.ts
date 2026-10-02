import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../../src/user/entities/user.entity';
import { Address } from '../../src/user/entities/address.entity';
import { Product } from '../../src/product/entities/product.entity';
import { Category } from '../../src/category/entities/category.entity';
import { Slider } from '../../src/slider/entities/slider.entity';
import { Order, OrderStatus } from '../../src/order/entities/order.entity';
import { Commission } from '../../src/affiliate/entities/commission.entity';
import { AuditLog } from '../../src/audit-log/entities/audit-log.entity';
import { MilestoneRewardConfig } from '../../src/admin/entities/milestone-reward-config.entity';
import { UserMilestone } from '../../src/admin/entities/user-milestone.entity';
import { BankingConfig } from '../../src/admin/entities/banking-config.entity';
import { SystemConfig } from '../../src/admin/entities/system-config.entity';
import { Staff } from '../../src/staff/entities/staff.entity';
import { StaffSession } from '../../src/staff/entities/staff-session.entity';
import { Role } from '../../src/role/entities/role.entity';
import { Permission } from '../../src/permission/entities/permission.entity';
import { Package } from '../../src/packages/entities/package.entity';
import { PackagePurchase } from '../../src/packages/entities/package-purchase.entity';
import { Kyc } from '../../src/kyc/entities/kyc.entity';
import { WalletDepositRequest } from '../../src/wallet/entities/wallet-deposit-request.entity';
import { WalletWithdrawRequest } from '../../src/wallet/entities/wallet-withdraw-request.entity';
import { UserBankAccount } from '../../src/wallet/entities/user-bank-account.entity';
import { MatrixRewardTree } from '../../src/matrix-reward/entities/matrix-reward-tree.entity';
import { MatrixRewardNode } from '../../src/matrix-reward/entities/matrix-reward-node.entity';
import { MatrixRewardLedger } from '../../src/matrix-reward/entities/matrix-reward-ledger.entity';
import { MatrixTreeExclusion } from '../../src/matrix-reward/entities/matrix-tree-exclusion.entity';
import { MatrixRewardOrderProcessed } from '../../src/matrix-reward/entities/matrix-reward-order-processed.entity';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { HeapRewardPlacement } from '../../src/heap-reward/entities/heap-reward-placement.entity';
import { HeapRewardHistory } from '../../src/heap-reward/entities/heap-reward-history.entity';
import { BranchVolumeLog } from '../../src/affiliate/entities/branch-volume-log.entity';
import { UserMonthlyStats } from '../../src/affiliate/entities/user-monthly-stats.entity';

dotenv.config();

const entities = [
  User,
  Address,
  Product,
  Category,
  Slider,
  Order,
  Commission,
  AuditLog,
  MilestoneRewardConfig,
  UserMilestone,
  BankingConfig,
  SystemConfig,
  Staff,
  StaffSession,
  Role,
  Permission,
  Package,
  PackagePurchase,
  Kyc,
  WalletDepositRequest,
  WalletWithdrawRequest,
  UserBankAccount,
  MatrixRewardTree,
  MatrixRewardNode,
  MatrixRewardLedger,
  MatrixTreeExclusion,
  MatrixRewardOrderProcessed,
  PasswordResetToken,
  HeapRewardPlacement,
  HeapRewardHistory,
  BranchVolumeLog,
  UserMonthlyStats,
];

async function getBinaryTreeMembers(dataSource: DataSource, parentId: string) {
  const users = await dataSource.getRepository(User).find({
    select: ['id', 'parentId', 'position', 'createdAt'],
  });

  const parentToChildren = new Map<string, any[]>();
  for (const u of users) {
    if (u.parentId) {
      if (!parentToChildren.has(u.parentId)) {
        parentToChildren.set(u.parentId, []);
      }
      parentToChildren.get(u.parentId)!.push(u);
    }
  }

  const traverse = (startPosition: 'left' | 'right'): any[] => {
    const descendants: any[] = [];
    const startChildren = parentToChildren.get(parentId) || [];
    const queue: Array<{ id: string; depth: number }> = [];

    for (const child of startChildren) {
      if (child.position === startPosition) {
        queue.push({ id: child.id, depth: 1 });
        descendants.push({ ...child, depth: 1 });
      }
    }

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;

      const children = parentToChildren.get(item.id) || [];
      for (const child of children) {
        const nextDepth = item.depth + 1;
        queue.push({ id: child.id, depth: nextDepth });
        descendants.push({ ...child, depth: nextDepth });
      }
    }
    return descendants;
  };

  return {
    leftMembers: traverse('left'),
    rightMembers: traverse('right'),
  };
}

async function run() {
  const dataSource = new DataSource({
    type: (process.env.DB_TYPE || 'postgres') as any,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: entities,
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Database connected.');

  // Let's test for user: 6635d6ca-6bd9-4e7c-a457-fc54fdf162d3 in July 2026
  const testUserId = '6635d6ca-6bd9-4e7c-a457-fc54fdf162d3';
  const year = 2026;
  const month = 7; // July

  const { leftMembers, rightMembers } = await getBinaryTreeMembers(dataSource, testUserId);
  const leftIds = leftMembers.map(m => m.id);
  const rightIds = rightMembers.map(m => m.id);

  console.log(`Left members count: ${leftIds.length}`);
  console.log(`Right members count: ${rightIds.length}`);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);

  const getVolumeForIds = async (ids: string[]): Promise<number> => {
    if (ids.length === 0) return 0;

    // Test with select (as in our current implementation)
    const ordersWithSelect = await dataSource.getRepository(Order)
      .createQueryBuilder('order')
      .select(['order.items', 'order.status'])
      .where('order.userId IN (:...ids)', { ids })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]
      })
      .andWhere('order.createdAt >= :start', { start })
      .andWhere('order.createdAt < :end', { end })
      .getMany();

    console.log(`Orders found with select: ${ordersWithSelect.length}`);
    if (ordersWithSelect.length > 0) {
      console.log('First order fields:', ordersWithSelect[0]);
    }

    // Test without select
    const ordersNoSelect = await dataSource.getRepository(Order)
      .createQueryBuilder('order')
      .where('order.userId IN (:...ids)', { ids })
      .andWhere('order.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED]
      })
      .andWhere('order.createdAt >= :start', { start })
      .andWhere('order.createdAt < :end', { end })
      .getMany();

    console.log(`Orders found without select: ${ordersNoSelect.length}`);
    if (ordersNoSelect.length > 0) {
      console.log('First order fields:', ordersNoSelect[0]);
    }

    let sum = 0;
    for (const order of ordersNoSelect) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        sum += (Number(item.price) || 0) * (Number(item.quantity) || 0);
      }
    }
    return sum;
  };

  const rightVolume = await getVolumeForIds(rightIds);
  console.log(`Calculated right volume: ${rightVolume}`);

  await dataSource.destroy();
}

run().catch(console.error);
