import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Address } from '../src/user/entities/address.entity';
import { Product } from '../src/product/entities/product.entity';
import { Category } from '../src/category/entities/category.entity';
import { Slider } from '../src/slider/entities/slider.entity';
import { Order } from '../src/order/entities/order.entity';
import { Commission } from '../src/affiliate/entities/commission.entity';
import { BranchVolumeLog } from '../src/affiliate/entities/branch-volume-log.entity';
import { AuditLog } from '../src/audit-log/entities/audit-log.entity';
import { MilestoneRewardConfig } from '../src/admin/entities/milestone-reward-config.entity';
import { UserMilestone } from '../src/admin/entities/user-milestone.entity';
import { BankingConfig } from '../src/admin/entities/banking-config.entity';
import { SystemConfig } from '../src/admin/entities/system-config.entity';
import { Staff } from '../src/staff/entities/staff.entity';
import { StaffSession } from '../src/staff/entities/staff-session.entity';
import { Role } from '../src/role/entities/role.entity';
import { Permission } from '../src/permission/entities/permission.entity';
import { Package } from '../src/packages/entities/package.entity';
import { PackagePurchase } from '../src/packages/entities/package-purchase.entity';
import { Kyc } from '../src/kyc/entities/kyc.entity';
import { WalletDepositRequest } from '../src/wallet/entities/wallet-deposit-request.entity';
import { WalletWithdrawRequest } from '../src/wallet/entities/wallet-withdraw-request.entity';
import { UserBankAccount } from '../src/wallet/entities/user-bank-account.entity';
import { MatrixRewardTree } from '../src/matrix-reward/entities/matrix-reward-tree.entity';
import { MatrixRewardNode } from '../src/matrix-reward/entities/matrix-reward-node.entity';
import { MatrixRewardLedger } from '../src/matrix-reward/entities/matrix-reward-ledger.entity';
import { MatrixTreeExclusion } from '../src/matrix-reward/entities/matrix-tree-exclusion.entity';
import { MatrixRewardOrderProcessed } from '../src/matrix-reward/entities/matrix-reward-order-processed.entity';
import { PasswordResetToken } from '../src/auth/entities/password-reset-token.entity';
import { HeapRewardPlacement } from '../src/heap-reward/entities/heap-reward-placement.entity';
import { HeapRewardHistory } from '../src/heap-reward/entities/heap-reward-history.entity';
import { RankPoolPlacement } from '../src/rank-pool/entities/rank-pool-placement.entity';
import { RankPoolHistory } from '../src/rank-pool/entities/rank-pool-history.entity';
import { UserMonthlyStats } from '../src/affiliate/entities/user-monthly-stats.entity';
import { AgentPool } from '../src/agent-pool/entities/agent-pool.entity';
import { AgentPoolMember } from '../src/agent-pool/entities/agent-pool-member.entity';
import { AgentPoolHistory } from '../src/agent-pool/entities/agent-pool-history.entity';

dotenv.config();

const VND_RATE = 25000;
const SUSPICIOUS_THRESHOLD = 100000;

const APP_ENTITIES = [
  User,
  Address,
  Product,
  Order,
  Commission,
  BranchVolumeLog,
  UserMonthlyStats,
  AuditLog,
  MilestoneRewardConfig,
  UserMilestone,
  BankingConfig,
  SystemConfig,
  Category,
  Slider,
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
  RankPoolPlacement,
  RankPoolHistory,
  AgentPool,
  AgentPoolMember,
  AgentPoolHistory,
];

async function createDataSource(): Promise<DataSource> {
  const dbType = (process.env.DB_TYPE || 'postgres') as any;
  const isMySQL = dbType === 'mysql';

  const dataSource = new DataSource({
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: APP_ENTITIES,
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}

function normalizeLegacyAmount(value: number | string | null | undefined): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num <= SUSPICIOUS_THRESHOLD) return num;
  return num / VND_RATE;
}

async function main() {
  const dataSource = await createDataSource();

  try {
    const historyRepo = dataSource.getRepository(AgentPoolHistory);
    const memberRepo = dataSource.getRepository(AgentPoolMember);
    const userRepo = dataSource.getRepository(User);

    const histories = await historyRepo.find({ order: { createdAt: 'ASC' } });
    let repairedHistories = 0;
    const userDelta = new Map<string, number>();

    for (const history of histories) {
      const oldReward = Number(history.rewardAmount ?? 0);
      const oldPoolTotal = Number(history.poolTotalAmount ?? 0);
      const oldOrderNet = Number(history.orderNetAmount ?? 0);

      const isLegacy =
        oldReward > SUSPICIOUS_THRESHOLD ||
        oldPoolTotal > SUSPICIOUS_THRESHOLD ||
        oldOrderNet > SUSPICIOUS_THRESHOLD;

      if (!isLegacy) continue;

      const correctedReward = normalizeLegacyAmount(oldReward);
      const correctedPoolTotal = normalizeLegacyAmount(oldPoolTotal);
      const correctedOrderNet = normalizeLegacyAmount(oldOrderNet);

      const delta = correctedReward - oldReward;
      if (history.userId) {
        userDelta.set(history.userId, (userDelta.get(history.userId) ?? 0) + delta);
      }

      await historyRepo.update(history.id, {
        rewardAmount: correctedReward,
        poolTotalAmount: correctedPoolTotal,
        orderNetAmount: correctedOrderNet,
      });

      repairedHistories += 1;
    }

    const memberRows = await memberRepo.find();
    let repairedMembers = 0;
    for (const member of memberRows) {
      const oldTotal = Number(member.totalRewarded ?? 0);
      if (oldTotal <= SUSPICIOUS_THRESHOLD) continue;
      const correctedTotal = normalizeLegacyAmount(oldTotal);
      if (correctedTotal !== oldTotal) {
        await memberRepo.update(member.id, { totalRewarded: correctedTotal });
        repairedMembers += 1;
      }
    }

    const users = await userRepo.find({ select: ['id', 'withdrawWalletBalance'] });
    let repairedUsers = 0;
    for (const user of users) {
      const delta = userDelta.get(user.id) ?? 0;
      if (!delta) continue;
      const currentBalance = Number(user.withdrawWalletBalance ?? 0);
      const nextBalance = currentBalance + delta;
      await userRepo.update(user.id, { withdrawWalletBalance: nextBalance });
      repairedUsers += 1;
    }

    console.log(`Repair complete. History rows repaired: ${repairedHistories}; member totals repaired: ${repairedMembers}; users adjusted: ${repairedUsers}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Repair script failed:', err);
  process.exit(1);
});
