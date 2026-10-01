import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { RewardReportController } from './reward-report.controller';
import { RewardReportService } from './reward-report.service';

/**
 * Read-only report over every reward table. It queries them with raw SQL, so
 * it only needs the User repository, to search and name the receivers.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [RewardReportController],
  providers: [RewardReportService],
})
export class RewardReportModule {}
