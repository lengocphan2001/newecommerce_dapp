import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
export declare class UserService {
    private userRepository;
    private addressRepository;
    constructor(userRepository: Repository<User>, addressRepository: Repository<Address>);
    findAll(): Promise<User[]>;
    findOne(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    findByWalletAddress(walletAddress: string): Promise<User | null>;
    findByUsername(username: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    countChildren(parentId: string, position: 'left' | 'right'): Promise<number>;
    getWeakLeg(parentId: string): Promise<'left' | 'right'>;
    findAvailableSlotInBranch(startUserId: string, targetPosition: 'left' | 'right'): Promise<{
        parentId: string;
        position: 'left' | 'right';
    }>;
    getDownline(userId: string, position?: 'left' | 'right'): Promise<User[]>;
    getBinaryTreeStats(userId: string): Promise<{
        left: {
            count: number;
            members: User[];
            volume: number;
        };
        right: {
            count: number;
            members: User[];
            volume: number;
        };
        total: number;
    }>;
    create(createUserDto: any): Promise<{
        id: string;
        avatar: string;
        addresses: Address[];
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
    update(id: string, updateUserDto: any): Promise<User | null>;
    remove(id: string): Promise<import("typeorm").DeleteResult>;
    getAddresses(userId: string): Promise<Address[]>;
    addAddress(userId: string, data: any): Promise<Address[]>;
    updateAddress(userId: string, addressId: string, data: any): Promise<Address | null>;
    deleteAddress(userId: string, addressId: string): Promise<import("typeorm").DeleteResult>;
}
