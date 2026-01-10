import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommissionPayoutController } from './commission-payout.controller';
import { User } from '../user/entities/user.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AffiliateModule, AuditLogModule],
  controllers: [AdminController, CommissionPayoutController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

