import { Injectable, UnauthorizedException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CommissionService } from '../affiliate/commission.service';
import { CommissionStatus } from '../affiliate/entities/commission.entity';
import { MilestoneRewardService } from '../admin/milestone-reward.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto, WalletRegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
    @Inject(forwardRef(() => MilestoneRewardService))
    private milestoneRewardService: MilestoneRewardService,
  ) { }

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

  async isFirstUser() {
    const count = await this.userService.countNonAdminUsers();
    return {
      isFirstUser: count === 0,
      count,
    };
  }

  async walletLogin(walletAddress: string) {
    const user = await this.userService.findByWalletAddress(walletAddress);
    if (!user) {
      throw new UnauthorizedException('Wallet address not registered');
    }

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
        fullName: user.fullName,
      },
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

    // Format decimal numbers with full precision
    const formatDecimal = (value: number | string): string => {
      if (value === null || value === undefined || value === 0) return '0.00';
      if (typeof value === 'string') {
        const [intPart, decPart] = value.split('.');
        if (decPart) {
          return `${intPart}.${decPart}`;
        }
        return `${intPart}.00`;
      }
      const numStr = value.toFixed(18);
      const [intPart, decPart] = numStr.split('.');
      return `${intPart}.${decPart}`;
    };

    // Get pending commissions for recent activity
    const pendingCommissions = await this.commissionService.getCommissions(userId, { status: CommissionStatus.PENDING });
    const recentCommissions = await this.commissionService.getCommissions(userId, {});
    const recentActivity = recentCommissions.slice(0, 5).map((c: any) => ({
      id: c.id,
      type: c.type,
      amount: formatDecimal(c.amount),
      status: c.status,
      createdAt: c.createdAt,
      fromUserId: c.fromUserId,
    }));

    return {
      referralCode,
      referralLink,
      leftLink,
      rightLink,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      walletAddress: user.walletAddress,
      phone: user.phone,
      phoneNumber: user.phone, // Alias for compatibility
      address: user.address,
      treeStats,
      accumulatedPurchases: formatDecimal(user.totalPurchaseAmount),
      bonusCommission: formatDecimal(user.totalCommissionReceived),
      packageType: user.packageType,
      totalReconsumptionAmount: formatDecimal(user.totalReconsumptionAmount),
      pendingRewards: formatDecimal(pendingCommissions.reduce((sum: number, c: any) => {
        const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
        return sum + amount;
      }, 0)),
      recentActivity,
      avatar: user.avatar,
      createdAt: user.createdAt,
      id: user.id,
    };
  }

  async getChildren(userId: string, position?: 'left' | 'right') {
    const children = await this.userService.getDownline(userId, position);
    return children.map((child: any) => {
      // Parse decimal values properly
      const parseDecimal = (value: any): number => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      return {
        id: child.id,
        username: child.username,
        fullName: child.fullName,
        avatar: child.avatar,
        packageType: child.packageType,
        position: child.position,
        leftBranchTotal: parseDecimal(child.leftBranchTotal),
        rightBranchTotal: parseDecimal(child.rightBranchTotal),
        totalPurchaseAmount: parseDecimal(child.totalPurchaseAmount),
        createdAt: child.createdAt,
      };
    });
  }

  async updateProfile(userId: string, data: any) {
    // Whitelist fields allow to update
    const allowed = ['fullName', 'email', 'phone', 'avatar'];
    const updateData: any = {};

    for (const key of allowed) {
      if (data[key] !== undefined) updateData[key] = data[key];
    }

    // Handle phoneNumber vs phone
    if (data.phoneNumber) updateData.phone = data.phoneNumber;

    return this.userService.update(userId, updateData);
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

    // Check if this is the first user (excluding admin)
    const nonAdminUserCount = await this.userService.countNonAdminUsers();
    const isFirstUser = nonAdminUserCount === 0;

    // Validate referral code (username) if provided and determine position in binary tree
    // If this is the first user, referral code is optional (they become root)
    let parentId: string | null = null;
    let position: 'left' | 'right' | null = null;
    let referralUserId: string | null = null; // Lưu ID của referral user (người giới thiệu ban đầu)

    if (walletRegisterDto.referralUser) {
      const referralUser = await this.userService.findByUsername(walletRegisterDto.referralUser);
      if (!referralUser) {
        throw new ConflictException('Referral code (username) does not exist');
      }

      referralUserId = referralUser.id; // Lưu ID của người giới thiệu ban đầu

      // Debug: Log received leg value (already transformed by DTO)
      // eslint-disable-next-line no-console

      // Check if leg is specified in DTO (from URL parameter ?leg=left or ?leg=right)
      // Value is already normalized by @Transform decorator in DTO
      if (walletRegisterDto.leg === 'left' || walletRegisterDto.leg === 'right') {
        // User chỉ định nhánh cụ thể, tìm slot trống trong nhánh đó
        const slot = await this.userService.findAvailableSlotInBranch(
          referralUserId,
          walletRegisterDto.leg,
        );
        parentId = slot.parentId; // Parent trực tiếp trong tree (có thể khác referralUser nếu đã đầy)
        position = slot.position;
        // eslint-disable-next-line no-console
      } else {
        // Automatically place in weak leg (leg with fewer children) của referral user
        const weakLeg = await this.userService.getWeakLeg(referralUserId);
        const slot = await this.userService.findAvailableSlotInBranch(referralUserId, weakLeg);
        parentId = slot.parentId; // Parent trực tiếp trong tree
        position = slot.position;
        // eslint-disable-next-line no-console
      }
    } else if (!isFirstUser) {
      // If not first user and no referral code provided, throw error
      throw new ConflictException('Referral code is required for registration');
    }
    // If isFirstUser and no referral code, parentId and position remain null (root user)

    // Create user without password
    // Lưu ý: 
    // - referralUser: username của người giới thiệu ban đầu (cho display)
    // - referralUserId: ID của người giới thiệu ban đầu (cho tính hoa hồng trực tiếp)
    // - parentId: ID của parent trực tiếp trong tree (có thể khác referralUserId nếu referral user đã đầy)
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
      referralUserId: referralUserId || null, // Store ID of referrer for direct commission
      parentId, // Store parent ID for tree structure
      position, // Store position (left/right) in binary tree
      status: 'ACTIVE',
    });

    // Tự động tạo address mặc định từ thông tin đăng ký
    // Luôn tạo address mặc định với thông tin có sẵn
    try {
      // Kết hợp address với country nếu có
      const addressParts: string[] = [];
      if (walletRegisterDto.address) {
        addressParts.push(walletRegisterDto.address);
      }
      if (walletRegisterDto.country) {
        addressParts.push(walletRegisterDto.country);
      }
      const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '';

      await this.userService.addAddress(user.id, {
        name: walletRegisterDto.fullName || 'Default Address',
        phone: walletRegisterDto.phoneNumber || '',
        address: fullAddress || walletRegisterDto.country || '',
        isDefault: true, // Set làm mặc định
      });
    } catch (error) {
      // Log error but don't fail registration
      console.error('Error creating default address:', error);
    }

    // Check and process milestone rewards for referrer (if exists)
    if (referralUserId) {
      try {
        await this.milestoneRewardService.checkAndProcessMilestones(referralUserId);
      } catch (error) {
        // Log error but don't fail registration
        console.error('Error processing milestone rewards:', error);
      }
    }

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

