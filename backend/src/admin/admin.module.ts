import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionPayoutController } from './commission-payout.controller';
import { CommissionConfigController } from './commission-config.controller';
import { CommissionConfigService } from './commission-config.service';
import { MilestoneRewardService } from './milestone-reward.service';
import { MilestoneRewardController } from './milestone-reward.controller';
import { User } from '../user/entities/user.entity';
import { CommissionConfig } from './entities/commission-config.entity';
import { MilestoneRewardConfig } from './entities/milestone-reward-config.entity';
import { UserMilestone } from './entities/user-milestone.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CommissionConfig, MilestoneRewardConfig, UserMilestone]),
    forwardRef(() => AffiliateModule),
    AuditLogModule,
  ],
  controllers: [
    AdminController,
    CommissionPayoutController,
    CommissionConfigController,
    MilestoneRewardController,
  ],
  providers: [AdminService, CommissionConfigService, MilestoneRewardService],
  exports: [AdminService, CommissionConfigService, MilestoneRewardService],
})
export class AdminModule {}

