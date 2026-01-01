import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { CommissionService } from '../affiliate/commission.service';
export declare class OrderService {
    private orderRepository;
    private productRepository;
    private userRepository;
    private commissionService;
    constructor(orderRepository: Repository<Order>, productRepository: Repository<Product>, userRepository: Repository<User>, commissionService: CommissionService);
    findAll(query: any): Promise<Order[]>;
    findOne(id: string): Promise<Order>;
    create(createOrderDto: CreateOrderDto, userId: string): Promise<Order>;
    updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto): Promise<Order>;
    cancelOrder(id: string): Promise<Order>;
    private checkIfReconsumption;
}
