/**
 * Script to initialize database tables (TypeORM synchronize + seed defaults).
 *
 * Bao gồm toàn bộ entity giống `app.module.ts`, trong đó bảng `users` có thêm:
 * - `loginOtpCode`, `loginOtpExpiresAt` — OTP email đăng nhập Web2 (username/password).
 * - Matrix reward pool: `matrix_reward_*`, `matrix_tree_exclusions`, `matrix_reward_order_processed`.
 *
 * Usage:
 *   npm run db:init
 *
 * Or directly:
 *   ts-node -r tsconfig-paths/register scripts/init-database.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
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
import {
  FAKE_ANALYTICS_DASHBOARD_KEY,
  getDefaultFakeAnalyticsDashboardPayload,
} from '../src/admin/fake-analytics-defaults';
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

// Load environment variables from .env file
dotenv.config();

/** Đảm bảo cột OTP đăng nhập Web2 tồn tại (DB cũ / edge cases sau synchronize). */
async function ensureUsersLoginOtpColumns(
  dataSource: DataSource,
  isMySQL: boolean,
): Promise<void> {
  if (isMySQL) {
    const rows = await dataSource.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('loginOtpCode', 'loginOtpExpiresAt')`,
    );
    const have = new Set(
      (rows as { COLUMN_NAME: string }[]).map((r) => r.COLUMN_NAME),
    );
    if (!have.has('loginOtpCode')) {
      await dataSource.query(
        `ALTER TABLE \`users\` ADD COLUMN \`loginOtpCode\` varchar(255) NULL`,
      );
      console.log('Added column users.loginOtpCode (MySQL).');
    }
    if (!have.has('loginOtpExpiresAt')) {
      await dataSource.query(
        `ALTER TABLE \`users\` ADD COLUMN \`loginOtpExpiresAt\` datetime(6) NULL`,
      );
      console.log('Added column users.loginOtpExpiresAt (MySQL).');
    }
    return;
  }

  await dataSource.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "loginOtpCode" character varying;
  `);
  await dataSource.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS "loginOtpExpiresAt" TIMESTAMP NULL;
  `);
}

async function ensureRankPoolTablesExist(
  dataSource: DataSource,
  isMySQL: boolean,
): Promise<void> {
  if (!isMySQL) return;

  try {
    // 1. Get the collation of users.id
    const collationRows = await dataSource.query(`
      SELECT COLLATION_NAME, CHARACTER_SET_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'
    `);

    let collation = '';
    let charset = '';

    if (collationRows && collationRows.length > 0) {
      collation = collationRows[0].COLLATION_NAME;
      charset = collationRows[0].CHARACTER_SET_NAME;
    } else {
      try {
        const dbDefaults = await dataSource.query(`
          SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
          FROM information_schema.SCHEMATA
          WHERE SCHEMA_NAME = DATABASE()
        `);
        if (dbDefaults && dbDefaults.length > 0) {
          collation = dbDefaults[0].DEFAULT_COLLATION_NAME;
          charset = dbDefaults[0].DEFAULT_CHARACTER_SET_NAME;
        }
      } catch (e) {
        console.error('Error fetching database default collation:', e);
      }
    }

    if (!collation) collation = 'utf8mb4_unicode_ci';
    if (!charset) charset = 'utf8mb4';

    console.log(`Detected users.id collation: ${collation}, charset: ${charset}`);

    // 2. Drop the tables if they exist to avoid conflict and recreate them with the correct collation
    await dataSource.query(`DROP TABLE IF EXISTS \`rank_pool_histories\``);
    await dataSource.query(`DROP TABLE IF EXISTS \`rank_pool_placements\``);

    // 3. Create the tables with the exact charset and collation
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS \`rank_pool_placements\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL,
        \`rank\` enum('LEADER','MANAGER','DIRECTOR','DIAMOND') NOT NULL,
        \`totalRewarded\` decimal(14,4) NOT NULL DEFAULT '0.0000',
        \`isActive\` tinyint NOT NULL DEFAULT '1',
        \`note\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_rank_pool_placements_userId\` (\`userId\`),
        KEY \`IDX_rank_pool_placements_rank\` (\`rank\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation};
    `);

    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS \`rank_pool_histories\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) CHARACTER SET ${charset} COLLATE ${collation} NOT NULL,
        \`rank\` enum('LEADER','MANAGER','DIRECTOR','DIAMOND') NOT NULL,
        \`amount\` decimal(14,4) NOT NULL,
        \`note\` text NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_rank_pool_histories_userId\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=${charset} COLLATE=${collation};
    `);

    console.log('Created rank_pool_placements and rank_pool_histories tables with correct collation.');
  } catch (err) {
    console.error('Error pre-creating rank pool tables:', err);
  }
}

async function initializeDatabase() {
  // Environment variables are loaded from .env file
  // Make sure .env file exists in backend directory

  const dbType = (process.env.DB_TYPE || 'postgres') as any;
  const isMySQL = dbType === 'mysql';

  const dbConfig = {
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
  };

  // Debug: Show connection info (without password)
  console.log('Database configuration:');
  console.log(`  Type: ${dbConfig.type}`);
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Username: ${dbConfig.username}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  Password: ${dbConfig.password ? '***' : 'NOT SET'}`);

  const dataSource = new DataSource({
    ...dbConfig,
    // Thứ tự giống backend/src/app.module.ts (TypeORM entities)
    entities: [
      User,
      Address,
      Product,
      Order,
      Commission,
      BranchVolumeLog,
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
      UserMonthlyStats,
      AgentPool,
      AgentPoolMember,
      AgentPoolHistory,
    ],
    synchronize: false, // Enable synchronize to create tables
    logging: true,
  });

  try {
    console.log('\nConnecting to database...');
    await dataSource.initialize();
    console.log('Database connected successfully!');

    // Pre-create rank pool tables with matching collation
    await ensureRankPoolTablesExist(dataSource, isMySQL);

    console.log('Synchronizing database schema...');
    await dataSource.synchronize();
    console.log('Database tables created successfully!');

    await ensureUsersLoginOtpColumns(dataSource, isMySQL);
    console.log(
      'Ensured users.loginOtpCode / users.loginOtpExpiresAt (Web2 email OTP).',
    );

    // Ensure default banking_config row exists (id=1) with latest fields.
    const bankingRepo = dataSource.getRepository(BankingConfig);
    let bankingConfig = await bankingRepo.findOne({ where: { id: 1 } });
    if (!bankingConfig) {
      bankingConfig = bankingRepo.create({
        id: 1,
        bankName: '',
        accountNumber: '',
        accountName: '',
        bankId: '',
        qrImageUrl: '',
        isEnabled: false,
        usdtPriceVnd: null,
        usdtWithdrawPriceVnd: null,
        usdtEnabled: false,
        usdtWalletAddress: '',
        usdtNetwork: 'TRC20',
        usdtQrImageUrl: '',
      });
      await bankingRepo.save(bankingConfig);
      console.log('Initialized default banking_config row (id=1).');
    } else {
      // Backfill new fields for older databases.
      bankingConfig.usdtEnabled = bankingConfig.usdtEnabled ?? false;
      bankingConfig.usdtWalletAddress = bankingConfig.usdtWalletAddress ?? '';
      bankingConfig.usdtNetwork = bankingConfig.usdtNetwork ?? 'TRC20';
      bankingConfig.usdtQrImageUrl = bankingConfig.usdtQrImageUrl ?? '';
      await bankingRepo.save(bankingConfig);
      console.log('Backfilled banking_config with latest fields.');
    }

    // Ensure default system config rows exist for payout + commission distribution.
    const systemConfigRepo = dataSource.getRepository(SystemConfig);
    const defaults: Array<{ key: string; value: string }> = [
      { key: 'minPayoutThreshold', value: '50' },
      { key: 'indirectCommissionRateF2', value: '5' },
      { key: 'commissionDepositWalletPercent', value: '20' },
      { key: 'commissionWithdrawWalletPercent', value: '70' },
      { key: 'matrixRewardEnabled', value: 'true' },
      { key: 'matrixRewardMinOrderUsd', value: '100' },
      { key: 'matrixRewardMaxOrderUsd', value: '0' },
      { key: 'matrixRewardPerSlotUsd', value: '0.5' },
      { key: 'matrixRewardMaxEarnPerTreeUsd', value: '1500' },
      { key: 'matrixRewardMaxUplines', value: '11' },
      { key: 'matrixRewardPrevTreeQualifyPercent', value: '100' },
      { key: 'HEAP_QUALIFY_ORDER_AMOUNT', value: '500' },
      { key: 'HEAP_DAILY_REWARD_PERCENT', value: '5' },
      { key: 'HEAP_MAX_PAYOUT', value: '1000' },
    ];
    for (const item of defaults) {
      const existed = await systemConfigRepo.findOne({ where: { key: item.key } });
      if (!existed) {
        await systemConfigRepo.save(
          systemConfigRepo.create({ key: item.key, value: item.value }),
        );
        console.log(`Initialized system_config ${item.key}=${item.value}`);
      }
    }

    const existingFake = await systemConfigRepo.findOne({
      where: { key: FAKE_ANALYTICS_DASHBOARD_KEY },
    });
    if (!existingFake) {
      await systemConfigRepo.save(
        systemConfigRepo.create({
          key: FAKE_ANALYTICS_DASHBOARD_KEY,
          value: JSON.stringify(getDefaultFakeAnalyticsDashboardPayload()),
        }),
      );
      console.log(`Initialized system_config ${FAKE_ANALYTICS_DASHBOARD_KEY} (demo analytics JSON)`);
    }

    await dataSource.destroy();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();
