import { Controller, Get, Query, UseGuards, Delete, Param } from '@nestjs/common';
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

  @Delete('placements/:id')
  async deletePlacement(@Param('id') id: string) {
    return this.heapRewardService.deletePlacement(id);
  }

  @Get('histories')
  async getHistories(@Query() query: any) {
    return this.heapRewardService.getHistories(query);
  }

  @Get('promising-placements')
  async getPromisingPlacements(@Query() query: any) {
    return this.heapRewardService.getPromisingPlacements(query);
  }

  @Delete('promising-placements/:id')
  async deletePromisingPlacement(@Param('id') id: string) {
    return this.heapRewardService.deletePromisingPlacement(id);
  }

  @Get('promising-histories')
  async getPromisingHistories(@Query() query: any) {
    return this.heapRewardService.getPromisingHistories(query);
  }
}
