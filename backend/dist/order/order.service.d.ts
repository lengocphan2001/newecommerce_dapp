export declare class OrderService {
    findAll(query: any): Promise<{
        message: string;
    }>;
    findOne(id: string): Promise<{
        message: string;
    }>;
    create(createOrderDto: any): Promise<{
        message: string;
    }>;
    updateStatus(id: string, updateStatusDto: any): Promise<{
        message: string;
    }>;
    cancelOrder(id: string): Promise<{
        message: string;
    }>;
}
