import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RankPoolService } from './rank-pool.service';
import { RankPoolController } from './rank-pool.controller';
import { RankPoolPlacement } from './entities/rank-pool-placement.entity';
import { RankPoolHistory } from './entities/rank-pool-history.entity';
import { User } from '../user/entities/user.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RankPoolPlacement, RankPoolHistory, User, SystemConfig])],
  controllers: [RankPoolController],
  providers: [RankPoolService],
  exports: [RankPoolService],
})
export class RankPoolModule {}
