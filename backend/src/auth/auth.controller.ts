import { Controller, Post, Body, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, WalletRegisterDto } from './dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}

