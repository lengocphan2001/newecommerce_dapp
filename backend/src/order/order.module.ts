import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { Order } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PackagesModule } from '../packages/packages.module';
import { MatrixRewardModule } from '../matrix-reward/matrix-reward.module';
import { HeapRewardModule } from '../heap-reward/heap-reward.module';
import { AgentPoolModule } from '../agent-pool/agent-pool.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Product, User]),
    forwardRef(() => AffiliateModule),
    forwardRef(() => AdminModule),
    forwardRef(() => MatrixRewardModule),
    forwardRef(() => HeapRewardModule),
    AgentPoolModule,
    NotificationsModule,
    PackagesModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
