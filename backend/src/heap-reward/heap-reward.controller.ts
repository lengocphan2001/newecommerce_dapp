import { Controller, Get, Query, UseGuards, Delete, Param, Post, Body } from '@nestjs/common';
import { HeapRewardService } from './heap-reward.service';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('admin/heap-reward')
@UseGuards(JwtAuthGuard, AdminGuard)
export class HeapRewardController {
  constructor(private readonly heapRewardService: HeapRewardService) {}

  @Post('sync')
  async syncOrders(
    @Body()
    body: {
      fromDate: string;
      skipWalletUpdate?: boolean;
    },
  ) {
    return this.heapRewardService.syncOrdersFromDate(body.fromDate, body.skipWalletUpdate);
  }

  @Post('rollback')
  async rollbackSync(
    @Body()
    body: {
      fromDate: string;
      poolType: string;
      poolLevel?: number;
    },
  ) {
    return this.heapRewardService.rollbackSync({
      fromDateStr: body.fromDate,
      poolType: body.poolType,
      poolLevel: body.poolLevel,
    });
  }

  @Get('placements')
  async getPlacements(@Query() query: any) {
    return this.heapRewardService.getPlacements(query);
  }

  @Delete('placements/:id')
  async deletePlacement(@Param('id') id: string) {
    return this.heapRewardService.deletePlacement(id);
  }

  @Post('placements/manual')
  async addManualPlacement(
    @Body()
    body: {
      userId: string;
      poolLevel: number;
    },
  ) {
    return this.heapRewardService.addManualPlacement(body.userId, body.poolLevel);
  }

  @Get('histories')
  async getHistories(@Query() query: any) {
    return this.heapRewardService.getHistories(query);
  }

}
