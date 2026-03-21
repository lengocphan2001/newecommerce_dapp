import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { WalletService } from '../wallet/wallet.service';
import { WalletWithdrawStatus } from '../wallet/entities/wallet-withdraw-request.entity';
import { ProcessWithdrawRequestDto } from '../wallet/dto/process-withdraw-request.dto';

@Controller('admin/wallet/withdraw-requests')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WalletWithdrawRequestController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async list(@Query('status') status?: string) {
    const statusEnum =
      status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
        ? (status as WalletWithdrawStatus)
        : undefined;
    return this.walletService.findAllWithdrawRequests(statusEnum);
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
