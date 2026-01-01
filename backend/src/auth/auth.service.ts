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

  async adminLogin(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Important: only allow admin users into the admin panel
    if (!user.isAdmin) {
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

  async checkReferral(username: string) {
    const user = await this.userService.findByUsername(username);
    return {
      exists: !!user,
      user: user ? {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
      } : null,
    };
  }

  async getReferralInfo(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user || !user.username) {
      throw new UnauthorizedException('User not found or username not set');
    }

    // Generate referral links for left and right legs
    const referralCode = user.username;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const referralLink = `${baseUrl}/register?ref=${referralCode}`;
    const leftLink = `${baseUrl}/register?ref=${referralCode}&leg=left`;
    const rightLink = `${baseUrl}/register?ref=${referralCode}&leg=right`;

    // Get binary tree stats
    const treeStats = await this.userService.getBinaryTreeStats(userId);

    return {
      referralCode,
      referralLink,
      leftLink,
      rightLink,
      username: user.username,
      fullName: user.fullName,
      treeStats,
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

    // Validate referral code (username) if provided and determine position in binary tree
    let parentId: string | null = null;
    let position: 'left' | 'right' | null = null;

    if (walletRegisterDto.referralUser) {
      const referralUser = await this.userService.findByUsername(walletRegisterDto.referralUser);
      if (!referralUser) {
        throw new ConflictException('Referral code (username) does not exist');
      }
      
      parentId = referralUser.id;
      
      // Debug: Log received leg value (already transformed by DTO)
      // eslint-disable-next-line no-console
      console.log(`[Referral Debug] Received leg value:`, walletRegisterDto.leg, `Type:`, typeof walletRegisterDto.leg);
      
      // Check if leg is specified in DTO (from URL parameter ?leg=left or ?leg=right)
      // Value is already normalized by @Transform decorator in DTO
      if (walletRegisterDto.leg === 'left' || walletRegisterDto.leg === 'right') {
        position = walletRegisterDto.leg;
        // eslint-disable-next-line no-console
        console.log(`[Referral] User ${walletRegisterDto.username} placed in ${position} leg by referral ${walletRegisterDto.referralUser}`);
      } else {
        // Automatically place in weak leg (leg with fewer children)
        position = await this.userService.getWeakLeg(parentId);
        // eslint-disable-next-line no-console
        console.log(`[Referral] User ${walletRegisterDto.username} auto-placed in ${position} leg (weak leg) by referral ${walletRegisterDto.referralUser}. Received leg: ${walletRegisterDto.leg || 'undefined'}`);
      }
    }

    // Create user without password
    const user = await this.userService.create({
      walletAddress: walletRegisterDto.walletAddress,
      chainId: walletRegisterDto.chainId,
      username: walletRegisterDto.username,
      country: walletRegisterDto.country,
      address: walletRegisterDto.address,
      phone: walletRegisterDto.phoneNumber,
      email: walletRegisterDto.email,
      fullName: walletRegisterDto.fullName,
      referralUser: walletRegisterDto.referralUser, // Store username for display
      parentId, // Store parent ID for tree structure
      position, // Store position (left/right) in binary tree
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

