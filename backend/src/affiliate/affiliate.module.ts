import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { CommissionService } from './commission.service';
import { Commission } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commission, User, Order])],
  controllers: [AffiliateController],
  providers: [AffiliateService, CommissionService],
  exports: [AffiliateService, CommissionService],
})
export class AffiliateModule {}

