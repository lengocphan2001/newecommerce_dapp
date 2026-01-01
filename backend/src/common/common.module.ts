import { Module, Global } from '@nestjs/common';
import { AdminSeedModule } from './seed/admin-seed.module';

@Global()
@Module({
  imports: [AdminSeedModule],
  providers: [],
  exports: [AdminSeedModule],
})
export class CommonModule {}

