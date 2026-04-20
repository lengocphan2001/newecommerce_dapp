import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HeapRewardService } from './heap-reward.service';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('admin/heap-reward')
@UseGuards(JwtAuthGuard, AdminGuard)
export class HeapRewardController {
  constructor(private readonly heapRewardService: HeapRewardService) {}

  @Get('placements')
  async getPlacements(@Query() query: any) {
    return this.heapRewardService.getPlacements(query);
  }

  @Get('histories')
  async getHistories(@Query() query: any) {
    return this.heapRewardService.getHistories(query);
  }
}
