import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { KycService } from './kyc.service';
import { SubmitKycDto, VerifyKycDto } from './dto';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  async submitKyc(@Body() kycDto: SubmitKycDto) {
    return this.kycService.submitKyc(kycDto);
  }

  @Get('status/:userId')
  async getKycStatus(@Param('userId') userId: string) {
    return this.kycService.getKycStatus(userId);
  }

  @Put('verify/:id')
  async verifyKyc(@Param('id') id: string, @Body() verifyDto: VerifyKycDto) {
    return this.kycService.verifyKyc(id, verifyDto);
  }
}

