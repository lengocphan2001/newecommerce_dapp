import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryPayment } from './entities/salary-payment.entity';
import { User } from '../user/entities/user.entity';
import { AgentPoolModule } from '../agent-pool/agent-pool.module';
import { AdminModule } from '../admin/admin.module';
import { SalaryService } from './salary.service';
import { AdminSalaryController } from './salary.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryPayment, User]),
    // Salaries are paid like agent pool rewards and share its wallet split.
    AgentPoolModule,
    // Reward sales come from AdminService.getMonthlyBranchSales.
    AdminModule,
  ],
  controllers: [AdminSalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
