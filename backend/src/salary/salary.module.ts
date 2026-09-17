import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryPayment } from './entities/salary-payment.entity';
import { RankSalaryPayment } from './entities/rank-salary-payment.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { AgentPoolModule } from '../agent-pool/agent-pool.module';
import { AdminModule } from '../admin/admin.module';
import { SalaryService } from './salary.service';
import { RankSalaryService } from './rank-salary.service';
import { AdminSalaryController } from './salary.controller';

@Module({
  imports: [
    // BankingConfig holds the USDT/VND rate the salary tiers are converted with.
    // Orders rewind purchase totals to the end of the month for the rank salary.
    TypeOrmModule.forFeature([
      SalaryPayment,
      RankSalaryPayment,
      User,
      Order,
      BankingConfig,
    ]),
    // Salaries are paid like agent pool rewards and share its wallet split.
    AgentPoolModule,
    // Reward sales come from AdminService.getMonthlyBranchSales.
    AdminModule,
  ],
  controllers: [AdminSalaryController],
  providers: [SalaryService, RankSalaryService],
  exports: [SalaryService, RankSalaryService],
})
export class SalaryModule {}
