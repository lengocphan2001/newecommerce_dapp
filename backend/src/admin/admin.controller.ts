import { Controller, Get, Put, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto';
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
      'Total Purchase Amount',
      'Total Commission Received',
      'Left Branch Total',
      'Right Branch Total',
      'Created At'
    ];

    const rows = users.map(user => [
      user.id,
      user.username || '',
      user.email,
      `"${(user.fullName || '').replace(/"/g, '""')}"`,
      user.phone || '',
      user.country || '',
      user.packageType || '',
      user.status,
      user.walletAddress || '',
      user.totalPurchaseAmount || 0,
      user.totalCommissionReceived || 0,
      user.leftBranchTotal || 0,
      user.rightBranchTotal || 0,
      user.createdAt
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

  @Get('tree/:userId')
  async getFullTree(@Param('userId') userId: string, @Query('maxDepth') maxDepth?: number) {
    return this.adminService.getFullTree(userId, maxDepth ? parseInt(maxDepth.toString(), 10) : 5);
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
}

