import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionPayoutController } from './commission-payout.controller';
import { CommissionConfigController } from './commission-config.controller';
import { CommissionConfigService } from './commission-config.service';
import { User } from '../user/entities/user.entity';
import { CommissionConfig } from './entities/commission-config.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, CommissionConfig]),
    forwardRef(() => AffiliateModule),
    AuditLogModule,
  ],
  controllers: [
    AdminController,
    CommissionPayoutController,
    CommissionConfigController,
  ],
  providers: [AdminService, CommissionConfigService],
  exports: [AdminService, CommissionConfigService],
})
export class AdminModule {}

