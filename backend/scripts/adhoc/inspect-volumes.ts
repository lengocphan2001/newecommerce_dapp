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

  // Find all users who have volume logs
  const users = await dataSource.getRepository(User).find({
    select: ['id', 'username', 'email', 'leftBranchTotal', 'rightBranchTotal', 'createdAt'],
  });

  console.log(`Total users: ${users.length}`);

  for (const u of users) {
    const logs = await dataSource.getRepository(BranchVolumeLog).find({
      where: { userId: u.id },
    });
    if (logs.length > 0 || u.leftBranchTotal > 0 || u.rightBranchTotal > 0) {
      console.log(`\nUser: ${u.username || u.email} (ID: ${u.id})`);
      console.log(`  Created At: ${u.createdAt}`);
      console.log(`  leftBranchTotal: ${u.leftBranchTotal} | rightBranchTotal: ${u.rightBranchTotal}`);
      console.log(`  Volume logs count: ${logs.length}`);
      for (const log of logs) {
        console.log(`    - Side: ${log.side} | Amount: ${log.amount} | Date: ${log.createdAt}`);
      }
    }
  }

  await dataSource.destroy();
}

run().catch(console.error);
