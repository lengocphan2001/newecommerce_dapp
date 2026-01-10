import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { CommissionPayoutService } from '../affiliate/commission-payout.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BatchPayoutDto, BatchPayoutResponseDto } from './dto/batch-payout.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogEntityType } from '../audit-log/entities/audit-log.entity';

@Controller('admin/commission-payout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CommissionPayoutController {
  constructor(
    private readonly commissionPayoutService: CommissionPayoutService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Get payout statistics
   */
  @Get('stats')
  async getPayoutStats() {
    return await this.commissionPayoutService.getPayoutStats();
  }

  /**
   * Get pending commissions ready for payout
   */
  @Get('pending')
  async getPendingCommissions(
    @Query('limit') limit?: string,
    @Query('minAmount') minAmount?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const minAmountNum = minAmount ? parseFloat(minAmount) : undefined;
    return await this.commissionPayoutService.getPendingCommissions(
      limitNum,
      minAmountNum,
    );
  }

  /**
   * Execute batch payout manually
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeBatchPayout(
    @Body() dto: BatchPayoutDto,
    @Request() req: any,
  ): Promise<BatchPayoutResponseDto> {
    const userId = req.user?.id;
    const username = req.user?.username || req.user?.email;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.commissionPayoutService.executeBatchPayout(
      dto,
      userId,
      username,
      ipAddress,
      userAgent,
    );
    return {
      ...result,
      recipients: dto.recipients.map((r) => r.walletAddress),
      amounts: dto.recipients.map((r) => r.amount),
      timestamp: new Date(),
    };
  }

  /**
   * Auto payout pending commissions
   */
  @Post('auto-payout')
  @HttpCode(HttpStatus.OK)
  async autoPayout(
    @Request() req: any,
    @Query('batchSize') batchSize?: string,
    @Query('minAmount') minAmount?: string,
  ) {
    const batchSizeNum = batchSize ? parseInt(batchSize, 10) : 50;
    const minAmountNum = minAmount ? parseFloat(minAmount) : undefined;
    return await this.commissionPayoutService.autoPayout(
      batchSizeNum,
      minAmountNum,
    );
  }

  /**
   * Get payout audit logs
   */
  @Get('audit-logs')
  async getPayoutAuditLogs(
    @Query('batchId') batchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.auditLogService.findPayoutLogs({
      batchId,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
