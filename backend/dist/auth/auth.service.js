"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_service_1 = require("../user/user.service");
const commission_service_1 = require("../affiliate/commission.service");
const commission_entity_1 = require("../affiliate/entities/commission.entity");
const bcrypt = __importStar(require("bcryptjs"));
let AuthService = class AuthService {
    userService;
    jwtService;
    commissionService;
    constructor(userService, jwtService, commissionService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.commissionService = commissionService;
    }
    async login(loginDto) {
        const user = await this.userService.findByEmail(loginDto.email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
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
    async adminLogin(loginDto) {
        const user = await this.userService.findByEmail(loginDto.email);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (!user.isAdmin) {
            throw new common_1.UnauthorizedException('Invalid credentials');
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
    async register(registerDto) {
        const existingUser = await this.userService.findByEmail(registerDto.email);
        if (existingUser) {
            throw new common_1.UnauthorizedException('Email already exists');
        }
        const user = await this.userService.create(registerDto);
        return {
            message: 'User registered successfully',
            user,
        };
    }
    async refreshToken(refreshDto) {
        try {
            const payload = this.jwtService.verify(refreshDto.refreshToken);
            const user = await this.userService.findOne(payload.sub);
            if (!user) {
                throw new common_1.UnauthorizedException();
            }
            const newPayload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
            const token = this.jwtService.sign(newPayload);
            return {
                token,
            };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async checkWallet(walletAddress) {
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
    async walletLogin(walletAddress) {
        const user = await this.userService.findByWalletAddress(walletAddress);
        if (!user) {
            throw new common_1.UnauthorizedException('Wallet address not registered');
        }
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
    async checkReferral(username) {
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
    async getReferralInfo(userId) {
        const user = await this.userService.findOne(userId);
        if (!user || !user.username) {
            throw new common_1.UnauthorizedException('User not found or username not set');
        }
        const referralCode = user.username;
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const referralLink = `${baseUrl}/register?ref=${referralCode}`;
        const leftLink = `${baseUrl}/register?ref=${referralCode}&leg=left`;
        const rightLink = `${baseUrl}/register?ref=${referralCode}&leg=right`;
        const treeStats = await this.userService.getBinaryTreeStats(userId);
        const formatDecimal = (value) => {
            if (value === null || value === undefined || value === 0)
                return '0.00';
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
        const pendingCommissions = await this.commissionService.getCommissions(userId, { status: commission_entity_1.CommissionStatus.PENDING });
        const recentCommissions = await this.commissionService.getCommissions(userId, {});
        const recentActivity = recentCommissions.slice(0, 5).map((c) => ({
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
            phoneNumber: user.phone,
            address: user.address,
            treeStats,
            accumulatedPurchases: formatDecimal(user.totalPurchaseAmount),
            bonusCommission: formatDecimal(user.totalCommissionReceived),
            packageType: user.packageType,
            totalReconsumptionAmount: formatDecimal(user.totalReconsumptionAmount),
            pendingRewards: formatDecimal(pendingCommissions.reduce((sum, c) => {
                const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
                return sum + amount;
            }, 0)),
            recentActivity,
            avatar: user.avatar,
        };
    }
    async updateProfile(userId, data) {
        const allowed = ['fullName', 'email', 'phone', 'avatar'];
        const updateData = {};
        for (const key of allowed) {
            if (data[key] !== undefined)
                updateData[key] = data[key];
        }
        if (data.phoneNumber)
            updateData.phone = data.phoneNumber;
        return this.userService.update(userId, updateData);
    }
    async walletRegister(walletRegisterDto) {
        const existingWalletUser = await this.userService.findByWalletAddress(walletRegisterDto.walletAddress);
        if (existingWalletUser) {
            throw new common_1.ConflictException('Wallet address already registered');
        }
        const existingEmailUser = await this.userService.findByEmail(walletRegisterDto.email);
        if (existingEmailUser) {
            throw new common_1.ConflictException('Email already exists');
        }
        const existingUsername = await this.userService.findByUsername(walletRegisterDto.username);
        if (existingUsername) {
            throw new common_1.ConflictException('Username already exists');
        }
        let parentId = null;
        let position = null;
        let referralUserId = null;
        if (walletRegisterDto.referralUser) {
            const referralUser = await this.userService.findByUsername(walletRegisterDto.referralUser);
            if (!referralUser) {
                throw new common_1.ConflictException('Referral code (username) does not exist');
            }
            referralUserId = referralUser.id;
            if (walletRegisterDto.leg === 'left' || walletRegisterDto.leg === 'right') {
                const slot = await this.userService.findAvailableSlotInBranch(referralUserId, walletRegisterDto.leg);
                parentId = slot.parentId;
                position = slot.position;
            }
            else {
                const weakLeg = await this.userService.getWeakLeg(referralUserId);
                const slot = await this.userService.findAvailableSlotInBranch(referralUserId, weakLeg);
                parentId = slot.parentId;
                position = slot.position;
            }
        }
        const user = await this.userService.create({
            walletAddress: walletRegisterDto.walletAddress,
            chainId: walletRegisterDto.chainId,
            username: walletRegisterDto.username,
            country: walletRegisterDto.country,
            address: walletRegisterDto.address,
            phone: walletRegisterDto.phoneNumber,
            email: walletRegisterDto.email,
            fullName: walletRegisterDto.fullName,
            referralUser: walletRegisterDto.referralUser,
            referralUserId: referralUserId || null,
            parentId,
            position,
            status: 'ACTIVE',
        });
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => commission_service_1.CommissionService))),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        commission_service_1.CommissionService])
], AuthService);
//# sourceMappingURL=auth.service.js.map