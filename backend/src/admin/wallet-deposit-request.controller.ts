import { Controller, Get, Patch, Param, Query, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { WalletService } from '../wallet/wallet.service';
import { ProcessDepositRequestDto } from '../wallet/dto/process-deposit-request.dto';
import { WalletDepositStatus } from '../wallet/entities/wallet-deposit-request.entity';

@Controller('admin/wallet/deposit-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WalletDepositRequestController {
  constructor(private readonly walletService: WalletService) {}

  /** Danh sách yêu cầu nạp tiền (lọc status: PENDING, APPROVED, REJECTED) */
  @Get()
  async list(@Query('status') status?: string) {
    const statusEnum = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
      ? (status as WalletDepositStatus)
      : undefined;
    return this.walletService.findAllDepositRequests(statusEnum);
  }

  /** Duyệt hoặc từ chối yêu cầu */
  @Patch(':id')
  async process(
    @Param('id') id: string,
    @Body() dto: ProcessDepositRequestDto,
    @Request() req: any,
  ) {
    const processedBy = req.user.sub;
    return this.walletService.processDepositRequest(id, dto, processedBy);
  }
}
