import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UserService {
    private userRepository;
    constructor(userRepository: Repository<User>);
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByWalletAddress(walletAddress: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    countChildren(parentId: string, position: 'left' | 'right'): Promise<number>;
    getWeakLeg(parentId: string): Promise<'left' | 'right'>;
    getDownline(userId: string, position?: 'left' | 'right'): Promise<User[]>;
    getBinaryTreeStats(userId: string): Promise<{
        left: {
            count: number;
            members: User[];
        };
        right: {
            count: number;
            members: User[];
        };
        total: number;
    }>;
    create(createUserDto: any): Promise<{
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
    update(id: string, updateUserDto: any): Promise<User | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
}
