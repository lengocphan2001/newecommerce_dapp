import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { RegisterAffiliateDto, WithdrawAffiliateDto } from './dto';

@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterAffiliateDto) {
    return this.affiliateService.register(registerDto);
  }

  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string) {
    return this.affiliateService.getStats(userId);
  }

  @Get('commissions/:userId')
  async getCommissions(@Param('userId') userId: string, @Query() query: any) {
    return this.affiliateService.getCommissions(userId, query);
  }

  @Post('withdraw')
  async withdraw(@Body() withdrawDto: WithdrawAffiliateDto) {
    return this.affiliateService.withdraw(withdrawDto);
  }
}

