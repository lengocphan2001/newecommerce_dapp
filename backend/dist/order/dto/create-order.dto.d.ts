export declare class OrderItemDto {
    productId: string;
    quantity: number;
}
export declare class CreateOrderDto {
    items: OrderItemDto[];
    transactionHash?: string;
    shippingAddress?: string;
}
