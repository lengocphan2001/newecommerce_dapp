import { Controller, Post, Body, Get, Query, UseGuards, Request, Put, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, WalletRegisterDto, WalletLoginDto } from './dto';
import { JwtAuthGuard } from '../common/guards';
import { CommissionConfigService } from '../admin/commission-config.service';
import { PackageType } from '../admin/entities/commission-config.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly commissionConfigService: CommissionConfigService,
  ) { }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() data: any) {
    return this.authService.updateProfile(req.user.sub, data);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('admin/login')
  async adminLogin(@Body() loginDto: LoginDto) {
    return this.authService.adminLogin(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('wallet/register')
  async walletRegister(@Body() walletRegisterDto: WalletRegisterDto) {
    return this.authService.walletRegister(walletRegisterDto);
  }

  @Get('wallet/check')
  async checkWallet(@Query('address') address: string) {
    return this.authService.checkWallet(address);
  }

  @Get('registration/is-first-user')
  async isFirstUser() {
    return this.authService.isFirstUser();
  }

  @Post('wallet/login')
  async walletLogin(@Body() walletLoginDto: WalletLoginDto) {
    return this.authService.walletLogin(walletLoginDto.walletAddress);
  }

  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshDto);
  }

  @Get('referral/check')
  async checkReferral(@Query('username') username: string) {
    return this.authService.checkReferral(username);
  }

  @Get('referral/info')
  @UseGuards(JwtAuthGuard)
  async getReferralInfo(@Request() req: any) {
    return this.authService.getReferralInfo(req.user.sub);
  }

  @Get('referral/children')
  @UseGuards(JwtAuthGuard)
  async getChildren(@Request() req: any, @Query('userId') userId?: string, @Query('position') position?: 'left' | 'right') {
    const targetUserId = userId || req.user.sub;
    return this.authService.getChildren(targetUserId, position);
  }

  @Get('commission-config/:packageType')
  async getCommissionConfig(@Param('packageType') packageType: string) {
    const config = await this.commissionConfigService.findByPackageType(
      packageType.toUpperCase() as PackageType
    );
    if (!config) {
      // Return defaults if not found
      return packageType.toUpperCase() === 'NPP'
        ? { packageValue: 0.001 }
        : { packageValue: 0.0001 };
    }
    return {
      packageValue: typeof config.packageValue === 'string' 
        ? parseFloat(config.packageValue) 
        : config.packageValue,
    };
  }
}

