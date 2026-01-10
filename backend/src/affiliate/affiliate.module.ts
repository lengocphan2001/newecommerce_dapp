import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { CommissionService } from './commission.service';
import { CommissionPayoutService } from './commission-payout.service';
import { CommissionPayoutScheduler } from './commission-payout.scheduler';
import { Commission } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Commission, User, Order]),
    BlockchainModule,
    AuditLogModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [AffiliateController],
  providers: [
    AffiliateService,
    CommissionService,
    CommissionPayoutService,
    CommissionPayoutScheduler,
  ],
  exports: [AffiliateService, CommissionService, CommissionPayoutService],
})
export class AffiliateModule {}

