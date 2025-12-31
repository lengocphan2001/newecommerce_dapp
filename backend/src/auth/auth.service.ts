import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto, WalletRegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.userService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new UnauthorizedException('Email already exists');
    }

    const user = await this.userService.create(registerDto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  async refreshToken(refreshDto: any) {
    try {
      const payload = this.jwtService.verify(refreshDto.refreshToken);
      const user = await this.userService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException();
      }

      const newPayload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
      const token = this.jwtService.sign(newPayload);

      return {
        token,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async checkWallet(walletAddress: string) {
    const user = await this.userService.findByWalletAddress(walletAddress);
    return {
      exists: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
      } : null,
    };
  }

  async walletRegister(walletRegisterDto: WalletRegisterDto) {
    // Check if wallet address already exists
    const existingWalletUser = await this.userService.findByWalletAddress(
      walletRegisterDto.walletAddress,
    );
    if (existingWalletUser) {
      throw new ConflictException('Wallet address already registered');
    }

    // Check if email already exists
    const existingEmailUser = await this.userService.findByEmail(walletRegisterDto.email);
    if (existingEmailUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.userService.findByUsername(walletRegisterDto.username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Create user without password
    const user = await this.userService.create({
      walletAddress: walletRegisterDto.walletAddress,
      chainId: walletRegisterDto.chainId,
      username: walletRegisterDto.username,
      country: walletRegisterDto.country,
      phone: walletRegisterDto.phoneNumber,
      email: walletRegisterDto.email,
      fullName: walletRegisterDto.username, // Use username as fullName for wallet users
      referralUser: walletRegisterDto.referralUser,
      status: 'ACTIVE',
    });

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress: user.walletAddress,
        chainId: user.chainId,
      },
    };
  }
}

