import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    findAll(): Promise<import("./entities/user.entity").User[]>;
    findOne(id: string): Promise<import("./entities/user.entity").User | null>;
    create(createUserDto: CreateUserDto): Promise<{
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
    }>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<import("./entities/user.entity").User | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
