import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { LoginDto, RegisterDto, WalletRegisterDto } from './dto';
export declare class AuthService {
    private userService;
    private jwtService;
    constructor(userService: UserService, jwtService: JwtService);
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
            email: string;
            fullName: string;
            phone: string;
            username: string;
            country: string;
            address: string;
            walletAddress: string;
            chainId: string;
            referralUser: string;
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
        treeStats: {
            left: {
                count: number;
                members: import("../user/entities/user.entity").User[];
            };
            right: {
                count: number;
                members: import("../user/entities/user.entity").User[];
            };
            total: number;
        };
    }>;
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
