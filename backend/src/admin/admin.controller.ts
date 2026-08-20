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
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
      'Address',
      'Avatar',
      'Chain ID',
      'Package Type',
      'Status',
      'Is Admin',
      'Email Verified',
      'Wallet Address',
      'Wallet Balance (Deposit)',
      'Withdraw Wallet Balance',
      'Referral User',
      'Referral User ID',
      'Parent ID',
      'Position',
      'Total Purchase Amount',
      'Total Commission Received',
      'Fake Received Commission',
      'Total Reconsumption Amount',
      'Left Branch Total',
      'Right Branch Total',
      'Password Changed At',
      'Created At',
      'Updated At',
    ];

    const rows = users.map((user) => [
      escapeCsv(user.id),
      escapeCsv(user.username),
      escapeCsv(user.email),
      escapeCsv(user.fullName),
      escapeCsv(user.phone),
      escapeCsv(user.country),
      escapeCsv(user.address),
      escapeCsv(user.avatar),
      escapeCsv(user.chainId),
      escapeCsv(user.packageType),
      escapeCsv(user.status),
      user.isAdmin ? 'true' : 'false',
      user.emailVerified ? 'true' : 'false',
      escapeCsv(user.walletAddress),
      user.walletBalance ?? 0,
      user.withdrawWalletBalance ?? 0,
      escapeCsv(user.referralUser),
      escapeCsv(user.referralUserId),
      escapeCsv(user.parentId),
      escapeCsv(user.position),
      user.totalPurchaseAmount ?? 0,
      user.totalCommissionReceived ?? 0,
      user.fakeReceivedCommission ?? 0,
      user.totalReconsumptionAmount ?? 0,
      user.leftBranchTotal ?? 0,
      user.rightBranchTotal ?? 0,
      escapeCsv(user.passwordChangedAt),
      escapeCsv(user.createdAt),
      escapeCsv(user.updatedAt),
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

  @Patch('users/:id/manual-rank')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserManualRank(
    @Param('id') id: string,
    @Body('rank') rank: string,
  ) {
    return this.adminService.updateUserManualRank(id, rank);
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

  @Get('system-config/all')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllSystemConfigs() {
    return this.adminService.getAllSystemConfigs();
  }

  @Patch('system-config/single')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateSingleSystemConfig(@Body() dto: { key: string; value: string }) {
    if (!dto.key) throw new BadRequestException('key is required');
    return this.adminService.updateSingleSystemConfig(dto.key, dto.value);
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

  /** Public — lấy danh sách loại sản phẩm (frontend dùng để render filter) */
  @Get('product-types')
  async getProductTypeConfigs() {
    return this.adminService.getProductTypeConfigs();
  }

  /** Admin — lưu danh sách loại sản phẩm */
  @Put('product-types')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async saveProductTypeConfigs(@Body() body: any) {
    if (!Array.isArray(body)) throw new BadRequestException('Body phải là mảng');
    return this.adminService.saveProductTypeConfigs(body);
  }

  /** Doanh số user theo tháng */
  @Get('monthly-sales')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getMonthlySales(@Query() query: any) {
    const now = new Date();
    const year  = parseInt(query.year  || String(now.getFullYear()), 10);
    const month = parseInt(query.month || String(now.getMonth() + 1), 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('year và month không hợp lệ');
    }
    return this.adminService.getMonthlySales(year, month);
  }

  /** Export CSV doanh số user theo tháng */
  @Get('monthly-sales/export')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async exportMonthlySales(@Query() query: any, @Res() res: Response) {
    const now = new Date();
    const year  = parseInt(query.year  || String(now.getFullYear()), 10);
    const month = parseInt(query.month || String(now.getMonth() + 1), 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('year và month không hợp lệ');
    }
    const rows = await this.adminService.getMonthlySales(year, month);

    const esc = (v: string | number | null | undefined) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ['User ID', 'Username', 'Full Name', 'Email', 'Package', 'Total Sales (PV)'];
    const csvLines = [
      headers.join(','),
      ...rows.map(r =>
        [esc(r.userId), esc(r.username), esc(r.fullName), esc(r.email), esc(r.packageType), r.totalSales.toFixed(4)].join(',')
      ),
    ].join('\n');

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="monthly-sales-${year}-${String(month).padStart(2,'0')}.csv"`);
    return res.send(csvLines);
  }

  /** Reset toàn bộ ví rút tiền (withdrawWalletBalance) về 0 cho tất cả user */
  @Post('users/reset-withdraw-wallet')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async resetAllWithdrawWallet(@Request() req: any) {
    const performedBy = req.user?.username || req.user?.id || 'admin';
    return this.adminService.resetAllWithdrawWalletBalances(performedBy);
  }

  @Post('users/import')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importUsers(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    const name = (file.originalname || '').toLowerCase();
    if (name && !name.endsWith('.csv')) {
      throw new BadRequestException('Only .csv files are supported');
    }
    return this.adminService.importUsersCsv(file.buffer);
  }

  @Post('orders/import')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  async importOrders(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    const name = (file.originalname || '').toLowerCase();
    if (name && !name.endsWith('.csv')) {
      throw new BadRequestException('Only .csv files are supported');
    }
    return this.adminService.importOrdersCsv(file.buffer);
  }
}
