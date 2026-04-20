import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeapRewardService } from './heap-reward.service';
import { HeapRewardController } from './heap-reward.controller';
import { HeapRewardPlacement } from './entities/heap-reward-placement.entity';
import { HeapRewardHistory } from './entities/heap-reward-history.entity';
import { UserModule } from '../user/user.module';
import { OrderModule } from '../order/order.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminModule } from '../admin/admin.module';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HeapRewardPlacement,
      HeapRewardHistory,
      User,
      Order,
      SystemConfig,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => OrderModule),
    forwardRef(() => WalletModule),
    AdminModule,
  ],
  controllers: [HeapRewardController],
  providers: [HeapRewardService],
  exports: [HeapRewardService],
})
export class HeapRewardModule {}
