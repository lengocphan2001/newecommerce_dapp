import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
export declare class OrderController {
    private readonly orderService;
    constructor(orderService: OrderService);
    findAll(query: any, req: any): Promise<import("./entities/order.entity").Order[]>;
    findOne(id: string, req: any): Promise<import("./entities/order.entity").Order>;
    create(createOrderDto: CreateOrderDto, req: any): Promise<import("./entities/order.entity").Order>;
    updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto, req: any): Promise<import("./entities/order.entity").Order>;
    cancelOrder(id: string): Promise<import("./entities/order.entity").Order>;
}
