import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import {
  UpdateUserStatusDto,
  UpdateFakeCommissionDto,
  DeductWithdrawWalletDto,
} from './dto';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  async getUsers(@Query() query: any) {
    return this.adminService.getUsers(query);
  }

  @Get('users/export')
  async exportUsers(@Res() res: Response) {
    const users = await this.adminService.exportUsers();

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
      'Username',
      'Email',
      'Full Name',
      'Phone',
      'Country',
      'Package Type',
      'Status',
      'Wallet Address',
      'Referral User',
      'Referral User ID',
      'Parent ID',
      'Position',
      'Total Purchase Amount',
      'Total Commission Received',
      'Left Branch Total',
      'Right Branch Total',
      'Created At',
    ];

    const rows = users.map((user) => [
      escapeCsv(user.id),
      escapeCsv(user.username),
      escapeCsv(user.email),
      escapeCsv(user.fullName),
      escapeCsv(user.phone),
      escapeCsv(user.country),
      escapeCsv(user.packageType),
      escapeCsv(user.status),
      escapeCsv(user.walletAddress),
      escapeCsv(user.referralUser),
      escapeCsv(user.referralUserId),
      escapeCsv(user.parentId),
      escapeCsv(user.position),
      user.totalPurchaseAmount ?? 0,
      user.totalCommissionReceived ?? 0,
      user.leftBranchTotal ?? 0,
      user.rightBranchTotal ?? 0,
      escapeCsv(user.createdAt),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="users.csv"');
    return res.send(csvContent);
  }

  @Post('users/export-login-credentials')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async exportLoginCredentials() {
    const { csvContent, stats } =
      await this.adminService.generateUserLoginCredentialsCsv();
    return { csvContent, stats };
  }

  @Post('users/:id/generate-password')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async generatePasswordForUser(@Param('id') id: string) {
    return this.adminService.generatePasswordForUser(id);
  }

  @Get('users/:id/detail')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Get('orders')
  async getOrders(@Query() query: any) {
    return this.adminService.getOrders(query);
  }

  @Put('users/:id/status')
  async updateUserStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, statusDto);
  }

  @Patch('users/:id/fake-commission')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserFakeCommission(
    @Param('id') id: string,
    @Body() dto: UpdateFakeCommissionDto,
  ) {
    return this.adminService.updateUserFakeReceivedCommission(
      id,
      dto.fakeReceivedCommission,
    );
  }

  /** Trừ số dư ví rút tiền (USDT) — không tạo yêu cầu rút; dùng khi điều chỉnh sai sót. */
  @Post('users/:id/withdraw-wallet/deduct')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deductUserWithdrawWallet(
    @Param('id') id: string,
    @Body() dto: DeductWithdrawWalletDto,
    @Request() req: any,
  ) {
    const performedBy =
      req.user?.sub || req.user?.id || req.user?.email || 'unknown';
    return this.adminService.deductUserWithdrawWalletBalance(
      id,
      dto.amount,
      dto.reason,
      String(performedBy),
    );
  }

  @Get('tree/:userId')
  async getFullTree(
    @Param('userId') userId: string,
    @Query('maxDepth') maxDepth?: number,
  ) {
    return this.adminService.getFullTree(
      userId,
      maxDepth ? parseInt(maxDepth.toString(), 10) : 5,
    );
  }

  /** Public endpoint — used by checkout to display QR banking info */
  @Get('banking-config')
  async getBankingConfig() {
    return this.adminService.getBankingConfig();
  }

  /** Admin-only — update banking config */
  @Put('banking-config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async upsertBankingConfig(@Body() dto: any) {
    return this.adminService.upsertBankingConfig(dto);
  }

  /** Public — get system settings (minPayoutThreshold etc.) */
  @Get('system-config')
  async getSystemConfig() {
    return this.adminService.getSystemConfig();
  }

  /** Admin-only — update system settings */
  @Patch('system-config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateSystemConfig(@Body() dto: any) {
    return this.adminService.updateSystemConfig(dto);
  }

  @Get('fake-analytics/default')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getFakeAnalyticsDashboardDefault() {
    return this.adminService.getDefaultFakeAnalyticsDashboard();
  }

  @Get('fake-analytics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getFakeAnalyticsDashboard() {
    return this.adminService.getFakeAnalyticsDashboard();
  }

  @Put('fake-analytics')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateFakeAnalyticsDashboard(@Body() body: any) {
    return this.adminService.updateFakeAnalyticsDashboard(body);
  }

  @Get('blockchain-config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getBlockchainConfig() {
    return this.adminService.getBlockchainConfig();
  }

  @Patch('blockchain-config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateBlockchainConfig(@Body() dto: any) {
    return this.adminService.updateBlockchainConfig(dto);
  }
}
