import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { StaffModule } from '../staff/staff.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [StaffModule, JwtModule, ConfigModule],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
