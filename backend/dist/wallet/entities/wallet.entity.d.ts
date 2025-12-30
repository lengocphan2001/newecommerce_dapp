import { User } from '../../user/entities/user.entity';
export declare class Wallet {
    id: string;
    userId: string;
    user: User;
    vndBalance: number;
    pointBalance: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class WalletTransaction {
    id: string;
    userId: string;
    user: User;
    type: string;
    currency: string;
    amount: number;
    status: string;
    description: string;
    relatedId: string;
    relatedType: string;
    adminNotes: string;
    createdAt: Date;
}
