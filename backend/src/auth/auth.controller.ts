import { Controller, Post, Body, Get, Query, UseGuards, Request, Put, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, WalletRegisterDto, WalletLoginDto } from './dto';
import { JwtAuthGuard } from '../common/guards';
import { PackagesService } from '../packages/packages.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly packagesService: PackagesService,
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

  @Post('send-verification-email')
  @UseGuards(JwtAuthGuard)
  async sendVerificationEmail(@Request() req: any) {
    return this.authService.sendVerificationEmail(req.user.sub);
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token || '');
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  async verifyEmailByCode(@Request() req: any, @Body() body: { code?: string }) {
    return this.authService.verifyEmailByCode(req.user.sub, body?.code || '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user);
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
    const config = await this.packagesService.findByCode(packageType.toUpperCase());

    if (!config) {
      // Return defaults if not found
      const pt = packageType.toUpperCase();
      if (pt === 'TV') return { packageValue: 0.001 };
      if (pt === 'NPP') return { packageValue: 0.01 };
      return { packageValue: 0.0001 };
    }

    return {
      packageValue: Number(config.price),
    };
  }

  @Get('reconsumption/check')
  @UseGuards(JwtAuthGuard)
  async checkReconsumption(@Request() req: any) {
    return this.authService.checkReconsumptionStatus(req.user.sub);
  }
}

