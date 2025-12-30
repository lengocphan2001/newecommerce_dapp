import { User } from '../../user/entities/user.entity';
export declare class Order {
    id: string;
    userId: string;
    user: User;
    items: OrderItem[];
    totalPoint: number;
    status: string;
    paymentMethod: string;
    shippingAddress: string;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    pointPrice: number;
    total: number;
}
