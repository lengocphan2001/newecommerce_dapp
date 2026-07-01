import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { MeController } from './me.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { Order } from '../order/entities/order.entity';
import { Commission } from '../affiliate/entities/commission.entity';
import { BranchVolumeLog } from '../affiliate/entities/branch-volume-log.entity';
import { UserMilestone } from '../admin/entities/user-milestone.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { Kyc } from '../kyc/entities/kyc.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Address,
      Order,
      Commission,
      BranchVolumeLog,
      UserMilestone,
      AuditLog,
      Kyc,
    ]),
  ],
  controllers: [UserController, MeController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
