import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AgentPoolService } from './agent-pool.service';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('admin/agent-pool')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAgentPoolController {
  constructor(private readonly agentPoolService: AgentPoolService) {}

  // ── Pool Management ───────────────────────────────────────────────────────

  @Get('pools')
  getAllPools() {
    return this.agentPoolService.getAllPools();
  }

  @Post('pools')
  createPool(
    @Body() dto: { code: string; name: string; percent: number; note?: string },
  ) {
    return this.agentPoolService.createPool(dto);
  }

  @Patch('pools/:id')
  updatePool(
    @Param('id') id: string,
    @Body() dto: { name?: string; percent?: number; isActive?: boolean; note?: string },
  ) {
    return this.agentPoolService.updatePool(id, dto);
  }

  @Delete('pools/:id')
  deletePool(@Param('id') id: string) {
    return this.agentPoolService.deletePool(id);
  }

  // ── Member Management ─────────────────────────────────────────────────────

  @Get('members')
  getMembers(
    @Query() query: { poolId?: string; isActive?: string; search?: string },
  ) {
    return this.agentPoolService.getMembers(query);
  }

  @Post('members')
  addMember(
    @Body() dto: { poolId: string; queryStr: string; note?: string },
  ) {
    return this.agentPoolService.addMember(dto);
  }

  @Patch('members/:id/status')
  updateMemberStatus(
    @Param('id') id: string,
    @Body() dto: { isActive: boolean },
  ) {
    return this.agentPoolService.updateMemberStatus(id, dto.isActive);
  }

  @Delete('members/:id')
  removeMember(@Param('id') id: string) {
    return this.agentPoolService.removeMember(id);
  }

  // ── Histories & Manual Trigger ───────────────────────────────────────────

  @Get('histories')
  getHistories(
    @Query() query: { poolId?: string; userId?: string; orderId?: string; limit?: string },
  ) {
    return this.agentPoolService.getHistories(query);
  }

  @Post('process-order/:orderId')
  async processOrderManually(@Param('orderId') orderId: string) {
    await this.agentPoolService.processOrder(orderId);
    return { success: true, message: `Processed AgentPool for order ${orderId}` };
  }

  // ── Rank Sync ─────────────────────────────────────────────────────────────

  /** Đồng bộ lại thành viên bể theo cấp bậc cho một người và tuyến trên. */
  @Post('members/sync-order/:orderId')
  syncMembersForOrder(@Param('orderId') orderId: string) {
    return this.agentPoolService.syncMembershipsForOrder(orderId);
  }

  /** Quét lại toàn hệ thống: dùng cho lần chạy đầu hoặc khi sửa cấp thủ công. */
  @Post('members/sync-all')
  syncAllMembers() {
    return this.agentPoolService.syncAllMemberships();
  }

  // ── Backfill ─────────────────────────────────────────────────────────────

  /** Chỉ đọc: liệt kê đơn đã duyệt còn thiếu bể và số tiền dự kiến bù. */
  @Get('backfill/preview')
  previewBackfill(@Query() query: { since?: string; limit?: string }) {
    return this.agentPoolService.previewBackfill(query);
  }

  /** Ghi tiền: chạy bù cho đúng những đơn admin đã chọn. */
  @Post('backfill/run')
  runBackfill(@Body() dto: { orderIds: string[] }) {
    return this.agentPoolService.runBackfill(dto);
  }
}

@Controller('agent-pool')
@UseGuards(JwtAuthGuard)
export class ClientAgentPoolController {
  constructor(private readonly agentPoolService: AgentPoolService) {}

  @Get('my-summary')
  getMySummary(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.agentPoolService.getUserSummary(userId);
  }
}
