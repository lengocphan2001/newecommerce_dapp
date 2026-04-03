import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { MatrixRewardService } from './matrix-reward.service';

@Controller('admin/matrix-reward')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MatrixRewardAdminController {
  constructor(private readonly matrixRewardService: MatrixRewardService) {}

  @Get('config')
  getConfig() {
    return this.matrixRewardService.getAdminConfig();
  }

  @Put('config')
  setConfig(
    @Body()
    body: {
      minOrderUsd?: number;
      perSlotUsd?: number;
      maxEarnPerTreeUsd?: number;
      maxUplines?: number;
      prevTreeQualifyPercent?: number;
      enabled?: boolean;
    },
  ) {
    return this.matrixRewardService.setAdminConfig(body);
  }

  @Get('trees/levels')
  listLevels() {
    return this.matrixRewardService.listTreeLevels();
  }

  /** Tạo sẵn cây matrix từ level 1..maxLevel để admin set root trước. */
  @Post('trees/prepare')
  prepareTrees(@Body() body: { maxLevel?: number }) {
    return this.matrixRewardService.ensureTreesUpTo(body.maxLevel ?? 1);
  }

  /**
   * Quét lại đơn CONFIRMED cũ để đưa vào matrix lần lượt theo createdAt.
   */
  @Post('orders/backfill')
  backfillOrders(
    @Body()
    body: {
      maxOrders?: number;
      fromDate?: string;
      onlyUnprocessed?: boolean;
    },
  ) {
    return this.matrixRewardService.backfillConfirmedOrders(body);
  }

  @Get('ledger/history')
  getLedgerHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('orderId') orderId?: string,
    @Query('type') type?: 'all' | 'credit' | 'debit',
  ) {
    return this.matrixRewardService.getLedgerHistory({
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      userId,
      orderId,
      type: type === 'credit' || type === 'debit' ? type : 'all',
    });
  }

  @Get('trees/:level/view')
  getTreeView(@Param('level', ParseIntPipe) level: number) {
    return this.matrixRewardService.getTreeViewForLevel(level);
  }

  /** Đặt user làm gốc cây (cây trống hoặc chỉ có gốc, chưa có con). */
  @Put('trees/:level/root')
  setTreeRoot(
    @Param('level', ParseIntPipe) level: number,
    @Body() body: { userId?: string },
  ) {
    return this.matrixRewardService.setAdminTreeRoot(level, body.userId ?? '');
  }

  @Post('reverse')
  reverseRewardByOrder(
    @Body()
    body: {
      userId?: string;
      orderId?: string;
      reason?: string;
    },
  ) {
    return this.matrixRewardService.reverseRewardByOrder({
      userId: body.userId ?? '',
      orderId: body.orderId ?? '',
      reason: body.reason,
    });
  }
}
