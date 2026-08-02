import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../src/user/entities/user.entity';
import { Address } from '../src/user/entities/address.entity';
import { Product } from '../src/product/entities/product.entity';
import { Category } from '../src/category/entities/category.entity';
import { Slider } from '../src/slider/entities/slider.entity';
import { Order } from '../src/order/entities/order.entity';
import { Commission } from '../src/affiliate/entities/commission.entity';
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
import { BranchVolumeLog } from '../src/affiliate/entities/branch-volume-log.entity';
import { UserMonthlyStats } from '../src/affiliate/entities/user-monthly-stats.entity';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CommissionService } from '../src/affiliate/commission.service';

dotenv.config();

async function run() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const commissionService = app.get(CommissionService);

  const month = '2026-08';
  console.log(`Calculating monthly rewards for ${month} (Simulation)...`);
  
  const result = await commissionService.calculateMonthlyRewards(month, false);
  
  console.log('--- SIMULATION RESULT ---');
  console.log(`Total National Sales: $${result.totalNationalSales.toLocaleString()} USD`);
  console.log(`Stats Count: ${result.statsCount}`);
  console.log(`Payout Count: ${result.payoutCount}`);
  console.log(`Total Payout Amount: $${result.totalPayoutAmount.toLocaleString()} USD`);
  console.log('--- USER STATS LIST ---');
  for (const stat of result.usersStats) {
    if (stat.calculatedRank !== 'C0' || stat.groupSales > 0 || stat.groupRewardAmount > 0 || stat.globalShareAmount > 0) {
      console.log(`User: ${stat.username || stat.email} | Rank: ${stat.calculatedRank} | Group Sales: $${stat.groupSales.toLocaleString()} | Group Reward: $${stat.groupRewardAmount.toLocaleString()} | Global Share: $${stat.globalShareAmount.toLocaleString()}`);
    }
  }

  await app.close();
}

run().catch(console.error);
