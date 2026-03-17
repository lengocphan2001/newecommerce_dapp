import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards';
import { CreateDepositRequestDto } from './dto';
import { WalletDepositStatus } from './entities/wallet-deposit-request.entity';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /** Số dư ví nạp tiền (user đăng nhập) */
  @Get('balance')
  @UseGuards(JwtAuthGuard)
  async getMyBalance(@Request() req: any) {
    const userId = req.user.sub;
    return this.walletService.getBalance(userId);
  }

  /** User tạo yêu cầu nạp tiền */
  @Post('deposit-requests')
  @UseGuards(JwtAuthGuard)
  async createDepositRequest(@Request() req: any, @Body() dto: CreateDepositRequestDto) {
    const userId = req.user.sub;
    return this.walletService.createDepositRequest(userId, dto);
  }

  /** User xem danh sách yêu cầu nạp tiền của mình */
  @Get('deposit-requests')
  @UseGuards(JwtAuthGuard)
  async getMyDepositRequests(@Request() req: any, @Query('status') status?: string) {
    const userId = req.user.sub;
    const statusEnum = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
      ? (status as WalletDepositStatus)
      : undefined;
    return this.walletService.getMyDepositRequests(userId, statusEnum);
  }
}
