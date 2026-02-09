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

    const queryBuilder = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .select([
        'order',
        'user.id',
        'user.username',
        'user.fullName',
        'user.email',
      ])
      .orderBy('order.createdAt', 'DESC');

    if (query.userId) {
      queryBuilder.andWhere('order.userId = :userId', { userId: query.userId });
    }
    if (query.status) {
      queryBuilder.andWhere('order.status = :status', { status: query.status });
    }

    return queryBuilder.getMany();
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

    // Determine initial status: If transactionHash is present (Crypto payment), CONFIRM immediately.
    // Otherwise (COD/Banking pending), set to PENDING.
    const initialStatus = createOrderDto.transactionHash ? OrderStatus.CONFIRMED : OrderStatus.PENDING;

    const order = this.orderRepository.create({
      userId,
      items,
      totalAmount: finalTotal,
      shippingFee: shippingFee > 0 ? shippingFee : undefined,
      status: initialStatus,
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

    // If Auto-Confirmed (Crypto), perform post-processing (Stock deduction, Commission, Payout)
    if (initialStatus === OrderStatus.CONFIRMED) {
      await this.approveOrder(savedOrder);
    }

    return savedOrder;
  }

  async confirmPayment(id: string, transactionHash: string, userId: string) {
    const order = await this.findOne(id);

    if (order.userId !== userId) {
      throw new Error('Unauthorized');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error('Order is not pending');
    }

    if (order.transactionHash) {
      throw new Error('Order already has a transaction hash');
    }

    order.transactionHash = transactionHash;
    order.status = OrderStatus.CONFIRMED;

    const savedOrder = await this.orderRepository.save(order);

    // Process post-confirmation logic (stock, commissions, etc.)
    await this.approveOrder(savedOrder);

    return savedOrder;
  }

  /**
   * Encapsulate order approval logic (Stock deduction, Commission, Payout, etc.)
   */
  private async approveOrder(order: Order) {
    // 1. Deduct Stock
    for (const item of order.items) {
      const product = await this.productRepository.findOne({ where: { id: item.productId } });
      if (product) {
        await this.productRepository.update(product.id, {
          stock: product.stock - item.quantity,
        });
      }
    }

    // 2. Check Reconsumption & Update User Totals
    if (order.userId) {
      const user = await this.userRepository.findOne({ where: { id: order.userId } });
      if (user) {
        const isReconsumption = await this.checkIfReconsumption(user, order.totalAmount);

        // Update Order flag
        if (isReconsumption) {
          await this.orderRepository.update(order.id, { isReconsumption: true });
        }

        // Update User Total Purchase & Reconsumption
        if (isReconsumption) {
          await this.userRepository.update(order.userId, {
            totalReconsumptionAmount: Number(user.totalReconsumptionAmount) + Number(order.totalAmount)
          });
        }
      }
    }

    // 3. Trigger Commission Calculation & Payout
    this.commissionService
      .calculateCommissions(order.id)
      .then(async () => {
        // Wait for DB commit
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Payout
        const payoutResult = await this.commissionPayoutService.payoutOrderCommissions(order.id);

        // Check Milestones
        const user = await this.userRepository.findOne({ where: { id: order.userId } });
        if (user && user.referralUserId) {
          this.milestoneRewardService.checkAndProcessMilestones(user.referralUserId)
            .catch(err => console.error('[AUTO-CONFIRM] Error processing milestones:', err));
        }

        console.log(`[AUTO-CONFIRM] Processed commissions for order ${order.id}`);
      })
      .catch(err => {
        console.error(`[AUTO-CONFIRM] Error processing commissions for order ${order.id}:`, err);
      });
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

      order.status = newStatus;
      const savedOrder = await this.orderRepository.save(order);

      // Execute approval logic
      await this.approveOrder(savedOrder);

      // Sync to Google Sheets
      const user = await this.userRepository.findOne({ where: { id: order.userId } });
      this.googleSheetsService.syncOrder(savedOrder, user || undefined);

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

