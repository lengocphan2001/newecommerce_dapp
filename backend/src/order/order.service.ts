import { Injectable, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { CommissionService } from '../affiliate/commission.service';
import { CommissionPayoutService } from '../affiliate/commission-payout.service';
import { PackagesService } from '../packages/packages.service';
import { GoogleSheetsService } from '../common/google-sheets.service';
import { MilestoneRewardService } from '../admin/milestone-reward.service';

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
    @Inject(forwardRef(() => CommissionPayoutService))
    private commissionPayoutService: CommissionPayoutService,
    private packagesService: PackagesService,
    private googleSheetsService: GoogleSheetsService,
    private milestoneRewardService: MilestoneRewardService,
  ) { }

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
      properties?: { [key: string]: string };
    }> = [];
    let totalAmount = 0;

    let shippingFee = 0;

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

      // Calculate shipping fee (take the highest fee among all items that have shipping fee)
      const fee = product.shippingFee ? Number(product.shippingFee) : 0;
      if (fee > 0) {
        if (fee > shippingFee) {
          shippingFee = fee;
        }
      }

      items.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        properties: item.properties, // Include selected properties
      });

      // Kiểm tra stock nhưng không trừ ngay (sẽ trừ khi admin duyệt)
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
    }

    // Add shipping fee to total amount
    const finalTotal = totalAmount + shippingFee;

    // Tạo đơn hàng với status PENDING (chờ admin duyệt)
    const order = this.orderRepository.create({
      userId,
      items,
      totalAmount: finalTotal,
      shippingFee: shippingFee > 0 ? shippingFee : undefined,
      status: OrderStatus.PENDING, // Chờ admin duyệt
      transactionHash: createOrderDto.transactionHash,
      shippingAddress: createOrderDto.shippingAddress,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Sync to Google Sheets
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      this.googleSheetsService.syncOrder(savedOrder, user || undefined);
    } catch (error) {
      console.error('Failed to sync to Google Sheets after creation:', error);
    }

    // Emit notification event (will be handled by order controller)
    // This allows the controller to inject NotificationsGateway

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

      // Sync to Google Sheets
      this.googleSheetsService.syncOrder(savedOrder, user || undefined);

      // Cập nhật tổng tái tiêu dùng nếu là đơn hàng tái tiêu dùng
      if (isReconsumption && user) {
        await this.userRepository.update(order.userId, {
          totalReconsumptionAmount:
            user.totalReconsumptionAmount + order.totalAmount,
        });
      }

      // Tính toán hoa hồng tự động và payout ngay lập tức (chạy async để không block response)
      this.commissionService
        .calculateCommissions(savedOrder.id)
        .then(async () => {
          // Đợi một chút để đảm bảo tất cả commissions đã được commit vào DB
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Sau khi tính commission xong, payout ngay lập tức
          const payoutResult = await this.commissionPayoutService.payoutOrderCommissions(savedOrder.id);

          // Check milestone rewards for the referrer
          if (user && user.referralUserId) {
            this.milestoneRewardService.checkAndProcessMilestones(user.referralUserId)
              .catch(err => console.error('[ORDER APPROVAL] Error processing milestones:', err));
          }

          if (payoutResult) {
            console.log(`[ORDER APPROVAL] Payout successful for order ${savedOrder.id}: ${payoutResult.count} commissions paid`);
          } else {
            console.warn(`[ORDER APPROVAL] Payout returned null for order ${savedOrder.id} - check logs for details`);
          }
          return payoutResult;
        })
        .catch((error) => {
          // Log error nhưng không block order approval
          console.error(`[ORDER APPROVAL] Error calculating commissions or payout for order ${savedOrder.id}:`, error);
          console.error('Error stack:', error.stack);
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
    const finalSavedOrder = await this.orderRepository.save(order);

    // Sync to Google Sheets
    try {
      const user = await this.userRepository.findOne({ where: { id: order.userId } });
      this.googleSheetsService.syncOrder(finalSavedOrder, user || undefined);
    } catch (error) {
      console.error('Failed to sync to Google Sheets after status update:', error);
    }

    return finalSavedOrder;
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
    const cancelledOrder = await this.orderRepository.save(order);

    // Sync to Google Sheets
    try {
      const user = await this.userRepository.findOne({ where: { id: order.userId } });
      this.googleSheetsService.syncOrder(cancelledOrder, user || undefined);
    } catch (error) {
      console.error('Failed to sync to Google Sheets after cancellation:', error);
    }

    return cancelledOrder;
  }

  /**
   * Kiểm tra xem đơn hàng có phải là tái tiêu dùng không
   * Logic mới (đơn giản hóa): User đã đạt ngưỡng hoa hồng và cần mua hàng với giá trị >= packageValue
   */
  private async checkIfReconsumption(
    user: User | null,
    orderAmount: number,
  ): Promise<boolean> {
    if (!user) {
      return false;
    }

    // Nếu user chưa có package (NONE), kiểm tra tất cả gói xem có đủ điều kiện không
    if (user.packageType === 'NONE') {
      const packages = await this.packagesService.findAll();

      for (const pkg of packages) {
        // Chỉ check nếu đã nhận đủ hoa hồng (dựa trên ngưỡng của gói đó)
        if (user.totalCommissionReceived >= pkg.reconsumptionThreshold) {
          // Nếu đơn hàng này đủ giá trị để "tái kích hoạt" hoặc "mua mới" gói này
          if (orderAmount >= pkg.price) {
            return true;
          }
        }
      }

      return false;
    }

    // User có packageType cụ thể
    const pkg = await this.packagesService.findByCode(user.packageType);

    if (!pkg) return false;

    // Nếu đã đạt ngưỡng và orderAmount >= price (hoặc reconsumptionRequired nếu logic khác) → là tái tiêu dùng
    // Note: packageValue ~ price
    if (user.totalCommissionReceived >= pkg.reconsumptionThreshold && orderAmount >= pkg.price) {
      return true;
    }

    return false;
  }
}

