import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    findAll(): Promise<import("./entities/user.entity").User[]>;
    findOne(id: string): Promise<import("./entities/user.entity").User | null>;
    create(createUserDto: CreateUserDto): Promise<{
        id: string;
        avatar: string;
        addresses: import("./entities/address.entity").Address[];
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
    }>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<import("./entities/user.entity").User | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
