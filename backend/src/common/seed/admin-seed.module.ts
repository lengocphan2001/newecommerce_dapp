import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffModule } from '../../staff/staff.module';
import { Staff } from '../../staff/entities/staff.entity';
import { StaffSeedService } from './staff-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Staff])],
  providers: [StaffSeedService],
  exports: [StaffSeedService],
})
export class AdminSeedModule {}


