import { Module, Global } from '@nestjs/common';
import { AdminSeedModule } from './seed/admin-seed.module';
import { GoogleSheetsService } from './google-sheets.service';

@Global()
@Module({
  imports: [AdminSeedModule],
  providers: [GoogleSheetsService],
  exports: [AdminSeedModule, GoogleSheetsService],
})
export class CommonModule {}

