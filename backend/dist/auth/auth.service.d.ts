import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CommissionService } from '../affiliate/commission.service';
import { LoginDto, RegisterDto, WalletRegisterDto } from './dto';
export declare class AuthService {
    private userService;
    private jwtService;
    private commissionService;
    constructor(userService: UserService, jwtService: JwtService, commissionService: CommissionService);
    login(loginDto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            isAdmin: boolean;
        };
    }>;
    adminLogin(loginDto: LoginDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            fullName: string;
            isAdmin: true;
        };
    }>;
    register(registerDto: RegisterDto): Promise<{
        message: string;
        user: {
            id: string;
            avatar: string;
            addresses: import("../user/entities/address.entity").Address[];
            email: string;
            fullName: string;
            phone: string;
            username: string;
            country: string;
            address: string;
            walletAddress: string;
            chainId: string;
            referralUser: string;
            referralUserId: string;
            parentId: string;
            position: "left" | "right";
            packageType: "NONE" | "CTV" | "NPP";
            totalPurchaseAmount: number;
            totalCommissionReceived: number;
            totalReconsumptionAmount: number;
            leftBranchTotal: number;
            rightBranchTotal: number;
            status: string;
            isAdmin: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    refreshToken(refreshDto: any): Promise<{
        token: string;
    }>;
    checkWallet(walletAddress: string): Promise<{
        exists: boolean;
        user: {
            id: string;
            email: string;
            username: string;
            walletAddress: string;
        } | null;
    }>;
    walletLogin(walletAddress: string): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            username: string;
            walletAddress: string;
            chainId: string;
            fullName: string;
        };
    }>;
    checkReferral(username: string): Promise<{
        exists: boolean;
        user: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    }>;
    getReferralInfo(userId: string): Promise<{
        referralCode: string;
        referralLink: string;
        leftLink: string;
        rightLink: string;
        username: string;
        fullName: string;
        email: string;
        walletAddress: string;
        phone: string;
        phoneNumber: string;
        address: string;
        treeStats: {
            left: {
                count: number;
                members: import("../user/entities/user.entity").User[];
                volume: number;
            };
            right: {
                count: number;
                members: import("../user/entities/user.entity").User[];
                volume: number;
            };
            total: number;
        };
        accumulatedPurchases: string;
        bonusCommission: string;
        packageType: "NONE" | "CTV" | "NPP";
        totalReconsumptionAmount: string;
        pendingRewards: string;
        recentActivity: {
            id: any;
            type: any;
            amount: string;
            status: any;
            createdAt: any;
            fromUserId: any;
        }[];
        avatar: string;
    }>;
    updateProfile(userId: string, data: any): Promise<import("../user/entities/user.entity").User | null>;
    walletRegister(walletRegisterDto: WalletRegisterDto): Promise<{
        token: string;
        user: {
            id: string;
            email: string;
            username: string;
            walletAddress: string;
            chainId: string;
        };
    }>;
}
