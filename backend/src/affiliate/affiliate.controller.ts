import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { RegisterAffiliateDto, WithdrawAffiliateDto } from './dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('affiliate')
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterAffiliateDto) {
    return this.affiliateService.register(registerDto);
  }

  @Get('all-stats')
  async getAllStats(@Request() req: any) {
    // Chỉ admin mới có thể xem tất cả stats
    // Route này phải đặt TRƯỚC route 'stats/:userId' để tránh conflict
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized: Only admin can view all affiliate stats');
    }
    return this.affiliateService.getAllStats();
  }

  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string, @Request() req: any) {
    // User chỉ có thể xem stats của mình (trừ admin)
    if (!req.user.isAdmin && userId !== (req.user.userId || req.user.sub)) {
      throw new Error('Unauthorized');
    }
    return this.affiliateService.getStats(userId);
  }

  @Get('commissions/:userId')
  async getCommissions(@Param('userId') userId: string, @Query() query: any, @Request() req: any) {
    // User chỉ có thể xem commissions của mình (trừ admin)
    if (!req.user.isAdmin && userId !== (req.user.userId || req.user.sub)) {
      throw new Error('Unauthorized');
    }
    return this.affiliateService.getCommissions(userId, query);
  }

  @Post('withdraw')
  async withdraw(@Body() withdrawDto: WithdrawAffiliateDto, @Request() req: any) {
    // User chỉ có thể rút tiền của mình
    const userId = req.user.userId || req.user.sub;
    return this.affiliateService.withdraw({ ...withdrawDto, userId });
  }
}

