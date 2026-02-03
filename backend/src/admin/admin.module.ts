import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionPayoutController } from './commission-payout.controller';
import { MilestoneRewardService } from './milestone-reward.service';
import { MilestoneRewardController } from './milestone-reward.controller';
import { User } from '../user/entities/user.entity';
import { MilestoneRewardConfig } from './entities/milestone-reward-config.entity';
import { UserMilestone } from './entities/user-milestone.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { Address } from '../user/entities/address.entity';
import { Order } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, MilestoneRewardConfig, UserMilestone, Address, Order, Product]),
    forwardRef(() => AffiliateModule),
    forwardRef(() => UserModule),
    forwardRef(() => OrderModule),
    AuditLogModule,
  ],
  controllers: [
    AdminController,
    CommissionPayoutController,
    MilestoneRewardController,
  ],
  providers: [AdminService, MilestoneRewardService],
  exports: [AdminService, MilestoneRewardService],
})
export class AdminModule { }

