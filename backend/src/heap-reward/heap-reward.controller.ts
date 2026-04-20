import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HeapRewardService } from './heap-reward.service';
import { JwtStaffAuthGuard } from '../auth/guards/jwt-staff-auth.guard';
import { PermissionsGuard } from '../permission/guards/permissions.guard';
import { RequirePermissions } from '../permission/decorators/permissions.decorator';
import { PERMISSION_ENUM } from '../permission/constants/permissions.constant';

@Controller('admin/heap-reward')
@UseGuards(JwtStaffAuthGuard, PermissionsGuard)
export class HeapRewardController {
  constructor(private readonly heapRewardService: HeapRewardService) {}

  @Get('placements')
  @RequirePermissions(PERMISSION_ENUM.READ_REPORTS) // Re-using reports or creating a new permission. We'll use READ_REPORTS for now
  async getPlacements(@Query() query: any) {
    return this.heapRewardService.getPlacements(query);
  }

  @Get('histories')
  @RequirePermissions(PERMISSION_ENUM.READ_REPORTS)
  async getHistories(@Query() query: any) {
    return this.heapRewardService.getHistories(query);
  }
}
