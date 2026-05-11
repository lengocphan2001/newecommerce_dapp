import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
      maxOrderUsd?: number;
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

  @Get('ledger/summary')
  getLedgerSummary(
    @Query('userId') userId?: string,
    @Query('orderId') orderId?: string,
  ) {
    return this.matrixRewardService.getLedgerSummary({
      userId,
      orderId,
    });
  }

  @Get('trees/:level/view')
  getTreeView(@Param('level', ParseIntPipe) level: number) {
    return this.matrixRewardService.getTreeViewForLevel(level);
  }

  @Get('trees/:level/export')
  async exportTreeNodes(
    @Param('level', ParseIntPipe) level: number,
    @Query('limit') limit?: string,
    @Res() res?: Response,
  ) {
    const data = await this.matrixRewardService.getRecentNodesForTreeLevel(
      level,
      Number(limit ?? 200),
    );
    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const s = val instanceof Date ? val.toISOString() : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers = [
      'Tree Level',
      'Tree ID',
      'Total Node Count',
      'Node ID',
      'User ID',
      'Username',
      'Full Name',
      'Email',
      'Package Type',
      'Position',
      'Parent Node ID',
      'Placement Order ID',
      'Matrix Earned On Tree',
      'Created At',
    ];
    const rows = data.items.map((item) => [
      data.treeLevel,
      data.treeId ?? '',
      data.totalNodeCount,
      item.nodeId,
      item.userId,
      item.username ?? '',
      item.fullName ?? '',
      item.email ?? '',
      item.packageType ?? '',
      item.position,
      item.parentNodeId ?? '',
      item.placementOrderId ?? '',
      item.matrixEarnedOnTree,
      item.createdAt,
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
    if (!res) return csv;
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header(
      'Content-Disposition',
      `attachment; filename="matrix-tree-${level}-recent-nodes.csv"`,
    );
    return res.send(csv);
  }

  /** Đặt user làm gốc cây (cây trống hoặc chỉ có gốc, chưa có con). */
  @Put('trees/:level/root')
  setTreeRoot(
    @Param('level', ParseIntPipe) level: number,
    @Body() body: { userId?: string },
  ) {
    return this.matrixRewardService.setAdminTreeRoot(level, body.userId ?? '');
  }

  @Post('trees/:level/add-user')
  addUserToTree(
    @Param('level', ParseIntPipe) level: number,
    @Body()
    body: {
      userId?: string;
    },
  ) {
    return this.matrixRewardService.addUserToTree(level, body.userId ?? '');
  }

  @Post('trees/:level/add-users')
  addUsersToTree(
    @Param('level', ParseIntPipe) level: number,
    @Body()
    body: {
      userIds?: string[];
    },
  ) {
    return this.matrixRewardService.addUsersToTreeInOrder(
      level,
      Array.isArray(body.userIds) ? body.userIds : [],
    );
  }

  @Post('trees/clear-all')
  clearAllTreesAndRewards() {
    return this.matrixRewardService.clearAllTreesAndRewards();
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

  @Post('reverse-all')
  reverseAllOutstandingRewards() {
    return this.matrixRewardService.reverseAllOutstandingRewards();
  }
}
