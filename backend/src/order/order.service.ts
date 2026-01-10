import { Injectable, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { CommissionService } from '../affiliate/commission.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
  ) {}

  async findAll(query: any) {
    const where: any = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.orderRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async create(createOrderDto: CreateOrderDto, userId: string) {
    // Lấy thông tin sản phẩm và tính tổng tiền
    const items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    }> = [];
    let totalAmount = 0;

    for (const item of createOrderDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      items.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
      });

      // Kiểm tra stock nhưng không trừ ngay (sẽ trừ khi admin duyệt)
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
    }

    // Tạo đơn hàng với status PENDING (chờ admin duyệt)
    const order = this.orderRepository.create({
      userId,
      items,
      totalAmount,
      status: OrderStatus.PENDING, // Chờ admin duyệt
      transactionHash: createOrderDto.transactionHash,
      shippingAddress: createOrderDto.shippingAddress,
    });

    const savedOrder = await this.orderRepository.save(order);
    return savedOrder;
  }

  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    const oldStatus = order.status;
    const newStatus = updateStatusDto.status as OrderStatus;

    // Nếu chuyển từ PENDING sang CONFIRMED (admin duyệt đơn hàng)
    if (oldStatus === OrderStatus.PENDING && newStatus === OrderStatus.CONFIRMED) {
      // Kiểm tra stock lại trước khi duyệt
      for (const item of order.items) {
        const product = await this.productRepository.findOne({
          where: { id: item.productId },
        });
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
        }
      }

      // Trừ stock khi duyệt đơn hàng
      for (const item of order.items) {
        const product = await this.productRepository.findOne({
          where: { id: item.productId },
        });
        if (product) {
          await this.productRepository.update(product.id, {
            stock: product.stock - item.quantity,
          });
        }
      }

      // Kiểm tra xem đây có phải đơn hàng tái tiêu dùng không
      const user = await this.userRepository.findOne({ where: { id: order.userId } });
      const isReconsumption = await this.checkIfReconsumption(user, order.totalAmount);

      order.status = newStatus;
      order.isReconsumption = isReconsumption;

      const savedOrder = await this.orderRepository.save(order);

      // Cập nhật tổng tái tiêu dùng nếu là đơn hàng tái tiêu dùng
      if (isReconsumption && user) {
        await this.userRepository.update(order.userId, {
          totalReconsumptionAmount:
            user.totalReconsumptionAmount + order.totalAmount,
        });
      }

      // Tính toán hoa hồng tự động (chạy async để không block response)
      this.commissionService
        .calculateCommissions(savedOrder.id)
        .catch((error) => {
        });

      return savedOrder;
    }

    // Nếu hủy đơn hàng, hoàn lại stock
    if (newStatus === OrderStatus.CANCELLED && oldStatus !== OrderStatus.CANCELLED) {
      for (const item of order.items) {
        const product = await this.productRepository.findOne({
          where: { id: item.productId },
        });
        if (product) {
          await this.productRepository.update(product.id, {
            stock: product.stock + item.quantity,
          });
        }
      }
    }

    order.status = newStatus;
    return this.orderRepository.save(order);
  }

  async cancelOrder(id: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.DELIVERED) {
      throw new Error('Cannot cancel delivered order');
    }

    // Hoàn lại stock
    for (const item of order.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });
      if (product) {
        await this.productRepository.update(product.id, {
          stock: product.stock + item.quantity,
        });
      }
    }

    order.status = OrderStatus.CANCELLED;
    return this.orderRepository.save(order);
  }

  /**
   * Kiểm tra xem đơn hàng có phải là tái tiêu dùng không
   */
  private async checkIfReconsumption(
    user: User | null,
    orderAmount: number,
  ): Promise<boolean> {
    if (!user || user.packageType === 'NONE') {
      return false;
    }

    const config =
      user.packageType === 'NPP'
        ? {
            RECONSUMPTION_THRESHOLD: 0.01, // TEST: giảm từ 1600 - Ngưỡng hoa hồng để cần tái tiêu dùng
            RECONSUMPTION_REQUIRED: 0.001, // TEST: giảm từ 400 - Số tiền tái tiêu dùng cần thiết
          }
        : {
            RECONSUMPTION_THRESHOLD: 0.001, // TEST: giảm từ 160 - Ngưỡng hoa hồng để cần tái tiêu dùng
            RECONSUMPTION_REQUIRED: 0.0001, // TEST: giảm từ 40 - Số tiền tái tiêu dùng cần thiết
          };

    // Nếu đã đạt ngưỡng hoa hồng và chưa đủ tái tiêu dùng
    if (user.totalCommissionReceived >= config.RECONSUMPTION_THRESHOLD) {
      const cycles = Math.floor(
        user.totalCommissionReceived / config.RECONSUMPTION_THRESHOLD,
      );
      const requiredReconsumption = cycles * config.RECONSUMPTION_REQUIRED;

      if (user.totalReconsumptionAmount < requiredReconsumption) {
        return true; // Đây là đơn hàng tái tiêu dùng
      }
    }

    return false;
  }
}

