import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { StaffSessionService } from './staff-session.service';
import { Staff } from './entities/staff.entity';
import { StaffSession } from './entities/staff-session.entity';
import { Role } from '../role/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Staff, StaffSession, Role])],
  controllers: [StaffController],
  providers: [StaffService, StaffSessionService],
  exports: [StaffService, StaffSessionService],
})
export class StaffModule {}
