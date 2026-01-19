import { Module, Global } from '@nestjs/common';
import { AdminSeedModule } from './seed/admin-seed.module';
import { GoogleSheetsService } from './google-sheets.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Global()
@Module({
  imports: [AdminSeedModule],
  providers: [GoogleSheetsService, PermissionsGuard],
  exports: [AdminSeedModule, GoogleSheetsService, PermissionsGuard],
})
export class CommonModule {}

