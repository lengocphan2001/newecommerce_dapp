import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentPool } from './entities/agent-pool.entity';
import { AgentPoolMember } from './entities/agent-pool-member.entity';
import { AgentPoolHistory } from './entities/agent-pool-history.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { AgentPoolService } from './agent-pool.service';
import {
  AdminAgentPoolController,
  ClientAgentPoolController,
} from './agent-pool.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentPool,
      AgentPoolMember,
      AgentPoolHistory,
      User,
      Order,
      BankingConfig,
    ]),
  ],
  controllers: [AdminAgentPoolController, ClientAgentPoolController],
  providers: [AgentPoolService],
  exports: [AgentPoolService],
})
export class AgentPoolModule {}
