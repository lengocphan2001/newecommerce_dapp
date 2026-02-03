import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { StaffService } from '../staff/staff.service';
import { CommissionService } from '../affiliate/commission.service';
import { CommissionStatus } from '../affiliate/entities/commission.entity';
import { MilestoneRewardService } from '../admin/milestone-reward.service';
import { PackagesService } from '../packages/packages.service';
import { MailService } from '../mail/mail.service';
import { LoginDto, RegisterDto, WalletRegisterDto } from './dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private staffService: StaffService,
    private jwtService: JwtService,
    private mailService: MailService,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
    @Inject(forwardRef(() => MilestoneRewardService))
    private milestoneRewardService: MilestoneRewardService,
    private packagesService: PackagesService,
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
    // Try to find staff first
    let staff = await this.staffService.findByEmail(loginDto.email);

    if (staff) {
      // Staff login
      if (staff.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      const isPasswordValid = await bcrypt.compare(loginDto.password, staff.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const payload = {
        sub: staff.id,
        email: staff.email,
        staffId: staff.id,
        isSuperAdmin: staff.isSuperAdmin,
        type: 'staff',
      };
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
      const token = this.jwtService.sign(payload, { expiresIn: expiresIn as any });

      // Calculate expiration date
      const expiresAt = new Date();
      const hours = expiresIn.includes('h') ? parseInt(expiresIn.replace('h', '')) : 24;
      expiresAt.setHours(expiresAt.getHours() + hours);

      // Create session (if StaffSessionService is available)
      // Note: This requires StaffSessionService to be injected
      // For now, we'll skip session creation to avoid circular dependency
      // Session can be created in a separate endpoint if needed

      return {
        token,
        expiresAt,
        user: {
          id: staff.id,
          email: staff.email,
          fullName: staff.fullName,
          isAdmin: true,
          isSuperAdmin: staff.isSuperAdmin,
          type: 'staff',
        },
      };
    }

    // Fallback to user with isAdmin flag (for backward compatibility)
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

    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin, type: 'user' };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isAdmin: user.isAdmin,
        type: 'user',
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

  async sendVerificationEmail(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    const expiresInMinutes = 10;
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
    await this.userService.setEmailVerificationToken(userId, code, expiresAt);

    const sent = this.mailService.isEnabled() &&
      (await this.mailService.sendVerificationCode(user.email, code, expiresInMinutes));
    if (!this.mailService.isEnabled() || !sent) {
      if (!this.mailService.isEnabled()) {
        return {
          message: 'Verification code generated. Configure SMTP to send by email.',
          code,
          expiresAt: expiresAt.toISOString(),
          expiresInMinutes,
        };
      }
      return {
        message: 'Failed to send email. Please try again or use the code below.',
        code,
        expiresAt: expiresAt.toISOString(),
        expiresInMinutes,
      };
    }
    return {
      message: 'Verification code sent to your email',
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes,
    };
  }

  async verifyEmailByCode(userId: string, code: string) {
    if (!code || code.trim().length !== 6) {
      throw new BadRequestException('Please enter the 6-digit code');
    }
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.emailVerified) {
      return { message: 'Email already verified' };
    }
    const trimmed = code.trim();
    if (user.emailVerificationToken !== trimmed) {
      throw new BadRequestException('Invalid verification code');
    }
    const now = new Date();
    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < now) {
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }
    await this.userService.setEmailVerified(user.id);
    return { message: 'Email verified successfully', email: user.email };
  }

  async verifyEmail(token: string) {
    if (!token || token.trim() === '') {
      throw new BadRequestException('Token is required');
    }
    const user = await this.userService.findByEmailVerificationToken(token.trim());
    if (!user) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    const now = new Date();
    if (user.emailVerificationExpiresAt && user.emailVerificationExpiresAt < now) {
      throw new BadRequestException('Verification link has expired');
    }
    await this.userService.setEmailVerified(user.id);
    return { message: 'Email verified successfully', email: user.email };
  }

  async getMe(user: any) {
    // If it's a staff user, return staff info with permissions
    if (user.type === 'staff' || user.staffId) {
      const staff = await this.staffService.findOne(user.staffId || user.sub);
      return {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        phone: staff.phone,
        avatar: staff.avatar,
        status: staff.status,
        isAdmin: true,
        isSuperAdmin: staff.isSuperAdmin,
        type: 'staff',
        roles: staff.roles?.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: role.permissions?.map((perm) => ({
            id: perm.id,
            code: perm.code,
            name: perm.name,
            description: perm.description,
            module: perm.module,
          })),
        })),
      };
    }

    // Legacy admin user
    const userEntity = await this.userService.findOne(user.sub);
    if (!userEntity) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: userEntity.id,
      email: userEntity.email,
      fullName: userEntity.fullName,
      isAdmin: userEntity.isAdmin,
      isSuperAdmin: false,
      type: 'user',
      roles: [],
      emailVerified: userEntity.emailVerified,
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
    const recentActivity = await Promise.all(recentCommissions.slice(0, 20).map(async (c: any) => {
      let fromUsername = c.fromUser?.username || c.fromUser?.fullName;

      // Fallback if relation didn't load
      if (!fromUsername && c.fromUserId) {
        try {
          const fromUser = await this.userService.findOne(c.fromUserId);
          if (fromUser) {
            fromUsername = fromUser.username || fromUser.fullName;
          }
        } catch (e) {
          // Ignore
        }
      }

      // Ensure createdAt is always a string (ISO format) for proper JSON serialization
      let createdAtStr: string | null = null;

      // Debug: log the commission to see what we have
      if (!c.createdAt) {
        console.warn('Commission missing createdAt:', c.id, c);
      }

      if (c.createdAt) {
        if (c.createdAt instanceof Date) {
          createdAtStr = c.createdAt.toISOString();
        } else if (typeof c.createdAt === 'string') {
          // Already a string, use it directly
          createdAtStr = c.createdAt;
        } else {
          // Try to convert to Date first, then to ISO string
          try {
            const date = new Date(c.createdAt as any);
            if (!isNaN(date.getTime())) {
              createdAtStr = date.toISOString();
            }
          } catch (e) {
            // If conversion fails, set to null
            createdAtStr = null;
          }
        }
      } else {
        // If createdAt is null/undefined, try to get it from database directly
        // This should not happen, but handle it gracefully
        console.error('Commission createdAt is null/undefined for commission:', c.id);
      }

      return {
        id: c.id,
        type: c.type,
        amount: formatDecimal(c.amount),
        status: c.status,
        createdAt: createdAtStr,
        fromUserId: c.fromUserId,
        fromUsername: fromUsername,
      };
    }));

    // Get commission config for max limit
    let maxCommission = '0.00';
    if (user.packageType !== 'NONE') {
      const config = await this.packagesService.findByCode(user.packageType);
      if (config) {
        maxCommission = formatDecimal(config.reconsumptionThreshold);
      }
    }

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
      maxCommission,
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
      emailVerified: user.emailVerified,
    };
  }

  /**
   * Kiểm tra trạng thái tái tiêu dùng của user
   * Trả về thông tin về việc user có cần tái tiêu dùng không
   */
  async checkReconsumptionStatus(userId: string) {
    const user = await this.userService.findOne(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Nếu user chưa có package hoặc packageType = NONE nhưng chưa đạt ngưỡng
    if (user.packageType === 'NONE') {
      const packages = await this.packagesService.findAll();

      let threshold = 0;
      let packageValue = 0;

      // Tìm gói có cấp độ cao nhất mà user đã đạt ngưỡng hoa hồng
      // Packages được sắp xếp theo level tăng dần từ service
      let reachedPackage: any = null;
      for (const pkg of packages) {
        if (user.totalCommissionReceived >= pkg.reconsumptionThreshold) {
          reachedPackage = pkg;
        }
      }

      if (reachedPackage) {
        threshold = reachedPackage.reconsumptionThreshold;
        packageValue = reachedPackage.price;
        return {
          needsReconsumption: true,
          threshold,
          packageValue,
          currentCommission: user.totalCommissionReceived,
          message: `Bạn đã đạt ngưỡng hoa hồng ${threshold} USDT. Vui lòng mua hàng với giá trị tối thiểu ${packageValue} USDT để tiếp tục nhận hoa hồng.`,
        };
      }

      return {
        needsReconsumption: false,
        message: 'Bạn chưa đạt ngưỡng hoa hồng.',
      };
    }

    // User có packageType
    const config = await this.packagesService.findByCode(user.packageType);

    if (!config) {
      return {
        needsReconsumption: false,
        message: 'Không tìm thấy cấu hình package.',
      };
    }

    const threshold = config.reconsumptionThreshold;
    const packageValue = config.price;

    // Nếu chưa đạt ngưỡng
    if (user.totalCommissionReceived < threshold) {
      return {
        needsReconsumption: false,
        threshold,
        currentCommission: user.totalCommissionReceived,
        remaining: threshold - user.totalCommissionReceived,
        message: `Bạn cần nhận thêm ${(threshold - user.totalCommissionReceived).toFixed(5)} USDT để đạt ngưỡng.`,
      };
    }

    // Đã đạt ngưỡng → cần tái tiêu dùng
    return {
      needsReconsumption: true,
      threshold,
      packageValue,
      currentCommission: user.totalCommissionReceived,
      message: `Bạn đã đạt ngưỡng hoa hồng ${threshold} USDT. Vui lòng mua hàng với giá trị tối thiểu ${packageValue} USDT để tiếp tục nhận hoa hồng.`,
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
        // User chỉ định nhánh cụ thể, tìm vị trí ngoài cùng (extreme) của nhánh đó
        const slot = await this.userService.findExtremeSlotInBranch(
          referralUserId,
          walletRegisterDto.leg,
        );
        parentId = slot.parentId; // Parent trực tiếp trong tree
        position = slot.position;
        // eslint-disable-next-line no-console
      } else {
        // Automatically place in weak leg (leg with fewer children) of referral user
        // But still use "Extreme" placement (bottom of the weak leg)
        const weakLeg = await this.userService.getWeakLeg(referralUserId);
        const slot = await this.userService.findExtremeSlotInBranch(referralUserId, weakLeg);
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

