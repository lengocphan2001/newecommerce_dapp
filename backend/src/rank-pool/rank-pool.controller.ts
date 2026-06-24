import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RankPoolService } from './rank-pool.service';
import { UserRank } from './entities/rank-pool-placement.entity';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('admin/rank-pool')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RankPoolController {
  constructor(private readonly rankPoolService: RankPoolService) {}

  // ── Config ──────────────────────────────────────────────────────────────────

  @Get('config')
  getConfig() {
    return this.rankPoolService.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() dto: Record<string, number>) {
    return this.rankPoolService.updateConfig(dto);
  }

  // ── Placements ──────────────────────────────────────────────────────────────

  @Get('placements')
  getPlacements(@Query() query: any) {
    return this.rankPoolService.getPlacements(query);
  }

  @Post('placements')
  addUser(@Body() dto: { userId: string; rank: UserRank; note?: string }) {
    if (!dto.userId || !dto.rank) throw new BadRequestException('userId và rank là bắt buộc');
    if (!Object.values(UserRank).includes(dto.rank))
      throw new BadRequestException('rank không hợp lệ');
    return this.rankPoolService.addUser(dto.userId, dto.rank, dto.note);
  }

  @Delete('placements/:id')
  removeUser(@Param('id') id: string) {
    return this.rankPoolService.removeUser(id);
  }

  @Patch('placements/:id/toggle')
  toggleActive(@Param('id') id: string) {
    return this.rankPoolService.toggleActive(id);
  }

  // ── Set rank trực tiếp cho user (không thêm vào pool) ──────────────────────

  @Patch('users/:userId/rank')
  setUserRank(@Param('userId') userId: string, @Body() dto: { rank: string }) {
    return this.rankPoolService.setUserRank(userId, dto.rank as any);
  }

  // ── Histories ───────────────────────────────────────────────────────────────

  @Get('histories')
  getHistories(@Query() query: any) {
    return this.rankPoolService.getHistories(query);
  }

  // ── Distribute ──────────────────────────────────────────────────────────────

  @Post('distribute')
  distribute(@Body() dto: { rank: UserRank; totalAmount: number; note?: string }) {
    if (!dto.rank || !Object.values(UserRank).includes(dto.rank))
      throw new BadRequestException('rank không hợp lệ');
    return this.rankPoolService.distribute(dto.rank, Number(dto.totalAmount), dto.note);
  }
}
