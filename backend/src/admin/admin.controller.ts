import { Controller, Get, Put, Patch, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto, UpdateFakeCommissionDto } from './dto';
import { JwtAuthGuard, AdminGuard } from '../common/guards';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

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

    const escapeCsv = (val: string | number | Date | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const s = val instanceof Date ? (isNaN(val.getTime()) ? '' : val.toISOString()) : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
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
      'Created At'
    ];

    const rows = users.map(user => [
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
      escapeCsv(user.createdAt)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', 'attachment; filename="users.csv"');
    return res.send(csvContent);
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
  async updateUserStatus(@Param('id') id: string, @Body() statusDto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, statusDto);
  }

  @Patch('users/:id/fake-commission')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserFakeCommission(@Param('id') id: string, @Body() dto: UpdateFakeCommissionDto) {
    return this.adminService.updateUserFakeReceivedCommission(id, dto.fakeReceivedCommission);
  }

  @Get('tree/:userId')
  async getFullTree(@Param('userId') userId: string, @Query('maxDepth') maxDepth?: number) {
    return this.adminService.getFullTree(userId, maxDepth ? parseInt(maxDepth.toString(), 10) : 5);
  }

  /** Public endpoint — used by checkout to display QR banking info */
  @Get('banking-config')
  async getBankingConfig() {
    return this.adminService.getBankingConfig();
  }

  /** Public endpoint — wallet receiving address for checkout transfers */
  @Get('payment-wallet')
  async getPaymentWallet() {
    return this.adminService.getPublicPaymentWallet();
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

  /** Admin-only — get runtime env config (sensitive values masked) */
  @Get('runtime-env-config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getRuntimeEnvConfig() {
    return this.adminService.getRuntimeEnvConfig();
  }

  /** Admin-only — update runtime env config keys */
  @Patch('runtime-env-config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateRuntimeEnvConfig(@Body() dto: any) {
    return this.adminService.updateRuntimeEnvConfig(dto);
  }
}

