import {
  Delete,
  Param,
  Patch,
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards';
import {
  CreateBankAccountDto,
  CreateDepositRequestDto,
  CreateWithdrawRequestDto,
  UpdateBankAccountDto,
} from './dto';
import { WalletDepositStatus } from './entities/wallet-deposit-request.entity';
import { WalletWithdrawStatus } from './entities/wallet-withdraw-request.entity';

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

  /** Số dư ví rút tiền */
  @Get('withdraw-balance')
  @UseGuards(JwtAuthGuard)
  async getMyWithdrawBalance(@Request() req: any) {
    const userId = req.user.sub;
    return this.walletService.getWithdrawBalance(userId);
  }

  /** User tạo yêu cầu nạp tiền */
  @Post('deposit-requests')
  @UseGuards(JwtAuthGuard)
  async createDepositRequest(
    @Request() req: any,
    @Body() dto: CreateDepositRequestDto,
  ) {
    const userId = req.user.sub;
    return this.walletService.createDepositRequest(userId, dto);
  }

  /** User xem danh sách yêu cầu nạp tiền của mình */
  @Get('deposit-requests')
  @UseGuards(JwtAuthGuard)
  async getMyDepositRequests(
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    const userId = req.user.sub;
    const statusEnum =
      status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? (status as WalletDepositStatus)
        : undefined;
    return this.walletService.getMyDepositRequests(userId, statusEnum);
  }

  @Get('bank-accounts')
  @UseGuards(JwtAuthGuard)
  async getMyBankAccounts(@Request() req: any) {
    return this.walletService.getMyBankAccounts(req.user.sub);
  }

  @Post('bank-accounts')
  @UseGuards(JwtAuthGuard)
  async createBankAccount(
    @Request() req: any,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.walletService.createBankAccount(req.user.sub, dto);
  }

  @Patch('bank-accounts/:id')
  @UseGuards(JwtAuthGuard)
  async updateBankAccount(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.walletService.updateBankAccount(req.user.sub, id, dto);
  }

  @Delete('bank-accounts/:id')
  @UseGuards(JwtAuthGuard)
  async deleteBankAccount(@Request() req: any, @Param('id') id: string) {
    return this.walletService.deleteBankAccount(req.user.sub, id);
  }

  @Post('withdraw-requests')
  @UseGuards(JwtAuthGuard)
  async createWithdrawRequest(
    @Request() req: any,
    @Body() dto: CreateWithdrawRequestDto,
  ) {
    return this.walletService.createWithdrawRequest(req.user.sub, dto);
  }

  @Get('withdraw-requests')
  @UseGuards(JwtAuthGuard)
  async getMyWithdrawRequests(
    @Request() req: any,
    @Query('status') status?: string,
  ) {
    const userId = req.user.sub;
    const statusEnum =
      status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? (status as WalletWithdrawStatus)
        : undefined;
    return this.walletService.getMyWithdrawRequests(userId, statusEnum);
  }
}
