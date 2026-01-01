import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto, WalletRegisterDto } from './dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
            status: string;
            isAdmin: boolean;
            createdAt: Date;
            updatedAt: Date;
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
    checkWallet(address: string): Promise<{
        exists: boolean;
        user: {
            id: string;
            email: string;
            username: string;
            walletAddress: string;
        } | null;
    }>;
    refresh(refreshDto: RefreshTokenDto): Promise<{
        token: string;
    }>;
    checkReferral(username: string): Promise<{
        exists: boolean;
        user: {
            id: string;
            username: string;
            fullName: string;
        } | null;
    }>;
    getReferralInfo(req: any): Promise<{
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
}
