import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatrixRewardTree } from './entities/matrix-reward-tree.entity';
import { MatrixRewardNode } from './entities/matrix-reward-node.entity';
import { MatrixRewardLedger } from './entities/matrix-reward-ledger.entity';
import { MatrixTreeExclusion } from './entities/matrix-tree-exclusion.entity';
import { MatrixRewardOrderProcessed } from './entities/matrix-reward-order-processed.entity';
import { Order } from '../order/entities/order.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';
import { User } from '../user/entities/user.entity';
import { MatrixRewardService } from './matrix-reward.service';
import { MatrixRewardUserController } from './matrix-reward-user.controller';
import { MatrixRewardAdminController } from './matrix-reward-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MatrixRewardTree,
      MatrixRewardNode,
      MatrixRewardLedger,
      MatrixTreeExclusion,
      MatrixRewardOrderProcessed,
      Order,
      SystemConfig,
      User,
    ]),
  ],
  providers: [MatrixRewardService],
  controllers: [MatrixRewardUserController, MatrixRewardAdminController],
  exports: [MatrixRewardService],
})
export class MatrixRewardModule {}
