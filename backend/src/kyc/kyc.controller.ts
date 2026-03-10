import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { KycService } from './kyc.service';
import { SubmitKycDto, VerifyKycDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const escapeCsv = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) { }

  @UseGuards(JwtAuthGuard)
  @Post('submit')
  async submitKyc(@Req() req: any, @Body() kycDto: SubmitKycDto) {
    const userId = req.user.userId;
    return this.kycService.submitKyc(userId, kycDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getMyKycStatus(@Req() req: any) {
    return this.kycService.getKycStatus(req.user.userId);
  }

  @Get('status/:userId')
  async getKycStatus(@Param('userId') userId: string) {
    return this.kycService.getKycStatus(userId);
  }

  @Get()
  async getAll() {
    return this.kycService.getAll();
  }

  @Put('verify/:id')
  async verifyKyc(@Param('id') id: string, @Body() verifyDto: VerifyKycDto) {
    return this.kycService.verifyKyc(id, verifyDto);
  }

  @Get('export')
  async exportKyc(@Res() res: Response) {
    const list = await this.kycService.getAllForExport();
    const headers = [
      'ID',
      'User ID',
      'User Email',
      'User Full Name',
      'Document Type',
      'Document Number',
      'Bank Name',
      'Bank Account Number',
      'Bank Account Holder',
      'Bank Branch',
      'Status',
      'Notes',
      'Created At',
      'Updated At',
    ];
    const rows = list.map((k: any) => [
      escapeCsv(k.id),
      escapeCsv(k.userId),
      escapeCsv(k.user?.email),
      escapeCsv(k.user?.fullName),
      escapeCsv(k.documentType),
      escapeCsv(k.documentNumber),
      escapeCsv(k.bankName),
      escapeCsv(k.bankAccountNumber),
      escapeCsv(k.bankAccountHolder),
      escapeCsv(k.bankBranch),
      escapeCsv(k.status),
      escapeCsv(k.notes),
      escapeCsv(k.createdAt),
      escapeCsv(k.updatedAt),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row: string[]) => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="kyc-export.csv"');
    return res.send(BOM + csvContent);
  }
}
