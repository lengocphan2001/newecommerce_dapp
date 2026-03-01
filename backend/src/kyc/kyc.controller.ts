import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { KycService } from './kyc.service';
import { SubmitKycDto, VerifyKycDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
}
