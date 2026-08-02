import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  Put,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AffiliateService } from './affiliate.service';
import {
  RegisterAffiliateDto,
  WithdrawAffiliateDto,
  ApproveCommissionDto,
  ApproveSingleCommissionDto,
  CancelCommissionBatchDto,
  CancelSingleCommissionDto,
} from './dto';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterAffiliateDto) {
    return this.affiliateService.register(registerDto);
  }

  @Get('all-stats')
  async getAllStats(@Request() req: any) {
    // Chỉ admin mới có thể xem tất cả stats
    // Route này phải đặt TRƯỚC route 'stats/:userId' để tránh conflict
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized: Only admin can view all affiliate stats');
    }
    return this.affiliateService.getAllStats();
  }

  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string, @Request() req: any) {
    // User chỉ có thể xem stats của mình (trừ admin)
    if (!req.user.isAdmin && userId !== (req.user.userId || req.user.sub)) {
      throw new Error('Unauthorized');
    }
    return this.affiliateService.getStats(userId);
  }

  @Get('commissions/:userId')
  async getCommissions(
    @Param('userId') userId: string,
    @Query() query: any,
    @Request() req: any,
  ) {
    // User chỉ có thể xem commissions của mình (trừ admin)
    if (!req.user.isAdmin && userId !== (req.user.userId || req.user.sub)) {
      throw new Error('Unauthorized');
    }
    return this.affiliateService.getCommissions(userId, query);
  }

  @Post('withdraw')
  async withdraw(
    @Body() withdrawDto: WithdrawAffiliateDto,
    @Request() req: any,
  ) {
    // User chỉ có thể rút tiền của mình
    const userId = req.user.userId || req.user.sub;
    return this.affiliateService.withdraw({ ...withdrawDto, userId });
  }

  // ========== Admin endpoints ==========

  @Get('admin/commissions')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllCommissions(@Query() query: any) {
    return this.affiliateService.getAllCommissions(query);
  }

  @Get('admin/commissions/export')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async exportCommissions(@Query() query: any, @Res() res: Response) {
    const commissions = await this.affiliateService.getAllCommissions(query);

    const escapeCsv = (
      val: string | number | Date | null | undefined,
    ): string => {
      if (val === null || val === undefined) return '';
      const s =
        val instanceof Date
          ? isNaN(val.getTime())
            ? ''
            : val.toISOString()
          : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n'))
        return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const headers = [
      'ID',
      'Receiver ID',
      'Receiver Email',
      'From User ID',
      'From User Email',
      'Type',
      'Status',
      'Amount (USDT)',
      'Side',
      'Order ID',
      'Notes',
      'Payout Tx Hash',
      'Created At',
    ];

    const rows = commissions.map((c) => [
      escapeCsv(c.id),
      escapeCsv(c.user?.id),
      escapeCsv(c.user?.email),
      escapeCsv(c.fromUser?.id),
      escapeCsv(c.fromUser?.email),
      escapeCsv(c.type),
      escapeCsv(c.status),
      c.amount ?? 0,
      escapeCsv(c.side),
      escapeCsv(c.orderId),
      escapeCsv(c.notes),
      escapeCsv(c.payoutTxHash),
      escapeCsv(c.createdAt),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="commissions.csv"');
    return res.send(csvContent);
  }

  @Get('admin/commissions/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getCommissionDetail(@Param('id') id: string) {
    return this.affiliateService.getCommissionDetail(id);
  }

  @Put('admin/commissions/:id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async approveCommission(
    @Param('id') id: string,
    @Body() approveDto: ApproveSingleCommissionDto,
    @Request() req: any,
  ) {
    const ctx = {
      userId: req.user?.id ?? req.user?.userId ?? req.user?.sub,
      username: req.user?.username ?? req.user?.email,
      ipAddress:
        req.ip ??
        req.headers?.['x-forwarded-for'] ??
        req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.affiliateService.approveCommission(id, approveDto.notes, ctx);
  }

  @Post('admin/commissions/approve-batch')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async approveCommissions(
    @Body() approveDto: ApproveCommissionDto,
    @Request() req: any,
  ) {
    const ctx = {
      userId: req.user?.id ?? req.user?.userId ?? req.user?.sub,
      username: req.user?.username ?? req.user?.email,
      ipAddress:
        req.ip ??
        req.headers?.['x-forwarded-for'] ??
        req.connection?.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    };
    return this.affiliateService.approveCommissions(
      approveDto.commissionIds,
      ctx,
    );
  }

  @Put('admin/commissions/:id/cancel')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async cancelCommission(
    @Param('id') id: string,
    @Body() dto: CancelSingleCommissionDto,
  ) {
    return this.affiliateService.cancelCommission(id, dto.reason);
  }

  @Post('admin/commissions/cancel-batch')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async cancelCommissionsBatch(@Body() dto: CancelCommissionBatchDto) {
    return this.affiliateService.cancelCommissions(
      dto.commissionIds,
      dto.reason,
    );
  }

  @Post('admin/commissions/compensate-missed-direct')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async compensateMissedDirectCommissions(
    @Body() body: { fromDate?: string }
  ) {
    return this.affiliateService.compensateMissedDirectCommissions(body.fromDate);
  }

  @Post('admin/orders/:id/compensate-commission')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async compensateSingleOrderCommission(
    @Param('id') id: string
  ) {
    return this.affiliateService.compensateSingleOrderCommission(id);
  }
}
