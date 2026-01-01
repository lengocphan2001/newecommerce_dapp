import { Module } from '@nestjs/common';
import { UserModule } from '../../user/user.module';
import { AdminSeedService } from './admin-seed.service';

@Module({
  imports: [UserModule],
  providers: [AdminSeedService],
  exports: [AdminSeedService],
})
export class AdminSeedModule {}


