import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionPayoutController } from './commission-payout.controller';
import { MilestoneRewardService } from './milestone-reward.service';
import { MilestoneRewardController } from './milestone-reward.controller';
import { WalletDepositRequestController } from './wallet-deposit-request.controller';
import { WalletWithdrawRequestController } from './wallet-withdraw-request.controller';
import { User } from '../user/entities/user.entity';
import { MilestoneRewardConfig } from './entities/milestone-reward-config.entity';
import { UserMilestone } from './entities/user-milestone.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { WalletModule } from '../wallet/wallet.module';
import { Address } from '../user/entities/address.entity';
import { Order } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { BankingConfig } from './entities/banking-config.entity';
import { SystemConfig } from './entities/system-config.entity';
import { Commission } from '../affiliate/entities/commission.entity';
import { WalletWithdrawRequest } from '../wallet/entities/wallet-withdraw-request.entity';
import { MatrixRewardLedger } from '../matrix-reward/entities/matrix-reward-ledger.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      MilestoneRewardConfig,
      UserMilestone,
      Address,
      Order,
      Product,
      BankingConfig,
      SystemConfig,
      Commission,
      WalletWithdrawRequest,
      MatrixRewardLedger,
    ]),
    forwardRef(() => AffiliateModule),
    forwardRef(() => UserModule),
    forwardRef(() => OrderModule),
    AuditLogModule,
    BlockchainModule,
    WalletModule,
  ],
  controllers: [
    AdminController,
    CommissionPayoutController,
    MilestoneRewardController,
    WalletDepositRequestController,
    WalletWithdrawRequestController,
  ],
  providers: [AdminService, MilestoneRewardService],
  exports: [AdminService, MilestoneRewardService, TypeOrmModule],
})
export class AdminModule {}
