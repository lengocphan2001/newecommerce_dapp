export declare class User {
    id: string;
    email: string;
    password: string;
    fullName: string;
    phone: string;
    username: string;
    country: string;
    address: string;
    walletAddress: string;
    chainId: string;
    referralUser: string;
    parentId: string;
    position: 'left' | 'right';
    packageType: 'NONE' | 'CTV' | 'NPP';
    totalPurchaseAmount: number;
    totalCommissionReceived: number;
    totalReconsumptionAmount: number;
    leftBranchTotal: number;
    rightBranchTotal: number;
    status: string;
    isAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
}
