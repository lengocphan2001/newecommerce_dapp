import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
export declare class OrderController {
    private readonly orderService;
    constructor(orderService: OrderService);
    findAll(query: any): Promise<{
        message: string;
    }>;
    findOne(id: string): Promise<{
        message: string;
    }>;
    create(createOrderDto: CreateOrderDto): Promise<{
        message: string;
    }>;
    updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto): Promise<{
        message: string;
    }>;
    cancelOrder(id: string): Promise<{
        message: string;
    }>;
}
