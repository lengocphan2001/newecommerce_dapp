import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { WalletService } from '../wallet/wallet.service';
import { WalletWithdrawStatus } from '../wallet/entities/wallet-withdraw-request.entity';
import { ProcessWithdrawRequestDto } from '../wallet/dto/process-withdraw-request.dto';

@Controller('admin/wallet/withdraw-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WalletWithdrawRequestController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async list(@Query('status') status?: string, @Query('q') q?: string) {
    const statusEnum =
      status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? (status as WalletWithdrawStatus)
        : undefined;
    return this.walletService.findAllWithdrawRequests(statusEnum, q);
  }

  @Get('export')
  async export(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Res() res?: Response,
  ) {
    const statusEnum =
      status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? (status as WalletWithdrawStatus)
        : undefined;
    const list = await this.walletService.findAllWithdrawRequests(statusEnum, q);
    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers = [
      'ID',
      'Created At',
      'User ID',
      'Username',
      'Full Name',
      'Email',
      'Phone',
      'Amount',
      'Actual Amount',
      'Method',
      'USDT Wallet Address',
      'Bank Name',
      'Bank Account Number',
      'Bank Account Name',
      'Status',
      'User Note',
      'Admin Note',
      'Processed At',
      'Processed By',
      'Tx Hash',
    ];
    const rows = list.map((r: any) => [
      escapeCsv(r.id),
      escapeCsv(r.createdAt),
      escapeCsv(r.userId),
      escapeCsv(r.user?.username),
      escapeCsv(r.user?.fullName),
      escapeCsv(r.user?.email),
      escapeCsv(r.user?.phone),
      escapeCsv(r.amount),
      escapeCsv(r.actualAmount),
      escapeCsv(r.method),
      escapeCsv(r.usdtWalletAddress),
      escapeCsv(r.bankName),
      escapeCsv(r.bankAccountNumber),
      escapeCsv(r.bankAccountName),
      escapeCsv(r.status),
      escapeCsv(r.note),
      escapeCsv(r.adminNote),
      escapeCsv(r.processedAt),
      escapeCsv(r.processedBy),
      escapeCsv(r.txHash),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    res!.header('Content-Type', 'text/csv; charset=utf-8');
    res!.header(
      'Content-Disposition',
      `attachment; filename="wallet-withdraw-requests-${Date.now()}.csv"`,
    );
    return res!.send(BOM + csvContent);
  }

  @Patch(':id')
  async process(
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawRequestDto,
    @Request() req: any,
  ) {
    const processedBy = req.user.sub;
    return this.walletService.processWithdrawRequest(id, dto, processedBy);
  }
}
