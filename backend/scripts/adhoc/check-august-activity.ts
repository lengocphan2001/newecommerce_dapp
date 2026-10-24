import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../../src/user/entities/user.entity';
import { Address } from '../../src/user/entities/address.entity';
import { Product } from '../../src/product/entities/product.entity';
import { Category } from '../../src/category/entities/category.entity';
import { Slider } from '../../src/slider/entities/slider.entity';
import { Order } from '../../src/order/entities/order.entity';
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

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

  // Find all users who have volume logs in August 2026
  const activeLogs = await dataSource.getRepository(BranchVolumeLog)
    .createQueryBuilder('log')
    .select('log.userId', 'userId')
    .addSelect("SUM(CASE WHEN log.side = 'left' THEN log.amount ELSE 0 END)", 'leftSum')
    .addSelect("SUM(CASE WHEN log.side = 'right' THEN log.amount ELSE 0 END)", 'rightSum')
    .where('log.createdAt >= :start', { start })
    .andWhere('log.createdAt < :end', { end })
    .groupBy('log.userId')
    .getRawMany<{ userId: string; leftSum: string; rightSum: string }>();

  console.log(`\n--- Active users with logs in ${now.getFullYear()}-${now.getMonth() + 1} ---`);
  console.log(`Total active users: ${activeLogs.length}`);

  for (const log of activeLogs) {
    const user = await dataSource.getRepository(User).findOne({
      where: { id: log.userId },
      select: ['username', 'email', 'walletAddress'],
    });
    const left = parseFloat(log.leftSum || '0') || 0;
    const right = parseFloat(log.rightSum || '0') || 0;
    const weak = Math.min(left, right);
    console.log(`User: ${user?.username || user?.email || user?.walletAddress || log.userId}`);
    console.log(`  Left monthly volume: ${left}`);
    console.log(`  Right monthly volume: ${right}`);
    console.log(`  Weak branch monthly volume (calculated): ${weak}`);
  }

  await dataSource.destroy();
}

run().catch(console.error);
