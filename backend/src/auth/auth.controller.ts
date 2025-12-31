import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, WalletRegisterDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
}

