/**
 * Parity check for AdminService.getMonthlyBranchSales().
 *
 * The endpoint walks the binary tree once for every user. The screens that
 * already exist use UserService.getBranchMonthlyVolume(), which runs a
 * recursive CTE per user. This script recomputes both for a sample of users
 * and reports any row where they disagree, so the one-pass version can be
 * trusted before it is exposed.
 *
 * Usage:
 *   cd backend
 *   npx ts-node -r tsconfig-paths/register scripts/adhoc/verify-branch-sales.ts [YYYY-MM] [sampleSize]
 */
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
import {
  buildChildrenMap,
  computeSubtreeAggregates,
} from '../../src/common/utils/referral-tree';

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

const VALID_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** Same rounding tolerance the CSV export prints at. */
const EPSILON = 1e-4;

async function run() {
  const monthArg = process.argv[2];
  const sampleSize = parseInt(process.argv[3] || '30', 10);

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (monthArg) {
    const [y, m] = monthArg.split('-').map((v) => parseInt(v, 10));
    if (!y || !m || m < 1 || m > 12) {
      throw new Error('Month argument must look like 2026-08');
    }
    year = y;
    month = m;
  }

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
  console.log(`Database connected. Checking ${year}-${String(month).padStart(2, '0')}.`);

  const userRepository = dataSource.getRepository(User);
  const orderRepository = dataSource.getRepository(Order);

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);

  // ---- One-pass version, mirroring AdminService.getMonthlyBranchSales ----
  const users = await userRepository.find({
    select: ['id', 'username', 'parentId', 'position'],
  });
  const orders = await orderRepository
    .createQueryBuilder('o')
    .select(['o.id', 'o.userId', 'o.items'])
    .where('o.status IN (:...statuses)', { statuses: VALID_STATUSES })
    .andWhere('o.createdAt >= :start', { start })
    .andWhere('o.createdAt < :end', { end })
    .andWhere('o.userId IS NOT NULL')
    .getMany();

  const personalSalesMap = new Map<string, number>();
  for (const order of orders) {
    if (!order.userId) continue;
    const items = Array.isArray(order.items) ? order.items : [];
    let value = 0;
    for (const item of items) {
      value += (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }
    personalSalesMap.set(
      order.userId,
      (personalSalesMap.get(order.userId) || 0) + value,
    );
  }

  const childrenMap = buildChildrenMap(users, (u) => u.id, (u) => u.parentId);
  const positionMap = new Map(users.map((u) => [u.id, u.position]));
  const { subtreeValue, cyclicNodeIds } = computeSubtreeAggregates(
    users.map((u) => u.id),
    childrenMap,
    (id) => personalSalesMap.get(id) || 0,
  );

  if (cyclicNodeIds.length > 0) {
    console.warn(
      `WARNING: ${cyclicNodeIds.length} node(s) sit in a parentId cycle: ${cyclicNodeIds.slice(0, 10).join(', ')}`,
    );
  }

  const bulk = new Map<string, { left: number; right: number }>();
  for (const u of users) {
    let left = 0;
    let right = 0;
    for (const childId of childrenMap.get(u.id) || []) {
      const side = positionMap.get(childId);
      if (side === 'left') left += subtreeValue.get(childId) || 0;
      else if (side === 'right') right += subtreeValue.get(childId) || 0;
    }
    bulk.set(u.id, { left, right });
  }

  // ---- Reference version, mirroring UserService.getBranchMonthlyVolume ----
  const isPostgres = userRepository.metadata.connection.options.type === 'postgres';
  const qParentId = isPostgres ? '"parentId"' : 'parentId';
  const param = isPostgres ? '$1' : '?';

  const referenceFor = async (userId: string) => {
    const descendants: Array<{ id: string; branch: 'left' | 'right' }> =
      await userRepository.query(
        `
      WITH RECURSIVE downline AS (
        SELECT id, ${qParentId}, position as branch
        FROM users
        WHERE ${qParentId} = ${param} AND position IN ('left', 'right')

        UNION ALL

        SELECT u.id, u.${qParentId}, d.branch
        FROM users u
        INNER JOIN downline d ON u.${qParentId} = d.id
      )
      SELECT id, branch FROM downline
    `,
        [userId],
      );

    const leftIds = descendants.filter((d) => d.branch === 'left').map((d) => d.id);
    const rightIds = descendants.filter((d) => d.branch === 'right').map((d) => d.id);

    const volumeFor = async (ids: string[]): Promise<number> => {
      if (ids.length === 0) return 0;
      const rows = await orderRepository
        .createQueryBuilder('order')
        .where('order.userId IN (:...ids)', { ids })
        .andWhere('order.status IN (:...statuses)', { statuses: VALID_STATUSES })
        .andWhere('order.createdAt >= :start', { start })
        .andWhere('order.createdAt < :end', { end })
        .getMany();

      let sum = 0;
      for (const order of rows) {
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          sum += (Number(item.price) || 0) * (Number(item.quantity) || 0);
        }
      }
      return sum;
    };

    return { left: await volumeFor(leftIds), right: await volumeFor(rightIds) };
  };

  // Prefer users who actually have a branch with sales; pad with any parent.
  const withSales = users.filter((u) => {
    const b = bulk.get(u.id)!;
    return b.left > 0 || b.right > 0;
  });
  const withChildren = users.filter((u) => (childrenMap.get(u.id) || []).length > 0);
  const pool = withSales.length > 0 ? withSales : withChildren;
  const sample = pool.slice(0, sampleSize);

  console.log(
    `Users: ${users.length}, orders in month: ${orders.length}, users with branch sales: ${withSales.length}. Checking ${sample.length}.`,
  );

  let mismatches = 0;
  for (const u of sample) {
    const fast = bulk.get(u.id)!;
    const slow = await referenceFor(u.id);
    const leftDiff = Math.abs(fast.left - slow.left);
    const rightDiff = Math.abs(fast.right - slow.right);

    if (leftDiff > EPSILON || rightDiff > EPSILON) {
      mismatches++;
      console.log(
        `MISMATCH ${u.username || u.id}: one-pass left=${fast.left} right=${fast.right} | per-user left=${slow.left} right=${slow.right}`,
      );
    } else {
      console.log(
        `ok ${u.username || u.id}: left=${fast.left} right=${fast.right} weak=${Math.min(fast.left, fast.right)}`,
      );
    }
  }

  console.log(
    mismatches === 0
      ? `\nPASS: ${sample.length} user(s) match.`
      : `\nFAIL: ${mismatches} of ${sample.length} user(s) disagree.`,
  );

  await dataSource.destroy();
  process.exit(mismatches === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
