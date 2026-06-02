import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { CommissionService } from '../affiliate/commission.service';
import { CommissionPayoutService } from '../affiliate/commission-payout.service';
import { PackagesService } from '../packages/packages.service';
import { GoogleSheetsService } from '../common/google-sheets.service';
import { MilestoneRewardService } from '../admin/milestone-reward.service';
import { MatrixRewardService } from '../matrix-reward/matrix-reward.service';
import { HeapRewardService } from '../heap-reward/heap-reward.service';

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
    @Inject(forwardRef(() => MatrixRewardService))
    private matrixRewardService: MatrixRewardService,
    @Inject(forwardRef(() => HeapRewardService))
    private heapRewardService: HeapRewardService,
  ) {}

  private getOrderItems(order: Order): Array<{
    productId: string;
    quantity: number;
  }> {
    const items = Array.isArray(order.items) ? order.items : [];
    return items.flatMap((item) => {
      if (!item?.productId || typeof item.quantity !== 'number') {
        return [];
      }
      return [{ productId: item.productId, quantity: item.quantity }];
    });
  }

  private async getProductsByIds(
    productIds: string[],
  ): Promise<Map<string, Product>> {
    const ids = [...new Set(productIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const products = await this.productRepository.find({ where: { id: In(ids) } });
    return new Map(products.map((product) => [product.id, product]));
  }

  private async updateStockByOrderItems(
    order: Order,
    mode: 'decrease' | 'increase',
  ): Promise<void> {
    const items = this.getOrderItems(order);
    const qtyByProductId = new Map<string, number>();
    for (const item of items) {
      qtyByProductId.set(
        item.productId,
        (qtyByProductId.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const productMap = await this.getProductsByIds([...qtyByProductId.keys()]);
    for (const [productId, quantity] of qtyByProductId.entries()) {
      const product = productMap.get(productId);
      if (!product) continue;
      const nextStock =
        mode === 'decrease'
          ? Math.max(0, product.stock - quantity)
          : product.stock + quantity;
      await this.productRepository.update(productId, { stock: nextStock });
    }
  }

  async findAll(query: any) {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
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
      // Backend stores status in lowercase enum values: pending/confirmed/...
      const normalizedStatus =
        typeof query.status === 'string'
          ? query.status.toLowerCase()
          : query.status;
      queryBuilder.andWhere('order.status = :status', {
        status: normalizedStatus,
      });
    }

    // Full-text-ish search (best effort) for admin table.
    // Supports: order id, user username/email, transaction hash.
    if (query.q) {
      const q = String(query.q).trim();
      if (q) {
        const like = `%${q.toLowerCase()}%`;
        queryBuilder.andWhere(
          `LOWER(order.id) LIKE :like
           OR LOWER(user.username) LIKE :like
           OR LOWER(user.email) LIKE :like
           OR LOWER(order.transactionHash) LIKE :like`,
          { like },
        );
      }
    }

    const rawLimit =
      query.limit != null ? parseInt(String(query.limit), 10) : NaN;
    if (Number.isFinite(rawLimit) && rawLimit > 0) {
      queryBuilder.take(Math.min(rawLimit, 100));
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

  async create(createOrderDto: CreateOrderDto, userId?: string) {
    // Lấy thông tin sản phẩm và tính tổng tiền
    const items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
      thumbnailUrl?: string;
      properties?: { [key: string]: string };
    }> = [];
    let totalAmount = 0;

    let shippingFee = 0;

    const productIds = [
      ...new Set(
        (createOrderDto.items || [])
          .map((item) => item?.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const products = productIds.length
      ? await this.productRepository.find({ where: { id: In(productIds) } })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of createOrderDto.items) {
      const product = productMap.get(item.productId);

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
        thumbnailUrl: product.thumbnailUrl ?? undefined,
        properties: item.properties, // Include selected properties
      });

    }

    // Add shipping fee to total amount
    const finalTotal = totalAmount + shippingFee;

    const paymentMethod = createOrderDto.paymentMethod || 'wallet';

    // Ví tiêu dùng (deposit_wallet) y Ví nạp PV (pv_wallet) solo se permiten para productos comunes (COMMON), no estratégicos
    if (paymentMethod === 'deposit_wallet' || paymentMethod === 'pv_wallet') {
      const strategicProducts = products.filter((p) =>
        (p.productTypes || []).includes('STRATEGIC'),
      );
      if (strategicProducts.length > 0) {
        const names = strategicProducts.map((p) => p.name).join(', ');
        throw new BadRequestException(
          `Ví tiêu dùng chỉ được dùng để mua sản phẩm thông dụng. Giỏ hàng có sản phẩm chiến lược: ${names}`,
        );
      }
    }

    // Yêu cầu đăng nhập nếu dùng ví thanh toán
    if ((paymentMethod === 'deposit_wallet' || paymentMethod === 'pv_wallet') && !userId) {
      throw new BadRequestException('Phương thức thanh toán bằng ví yêu cầu người dùng đăng nhập.');
    }

    // Ví nạp tiền: trừ số dư và xác nhận đơn ngay
    if (paymentMethod === 'deposit_wallet' && userId) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      const balance = Number(user.walletBalance ?? 0);
      if (balance < finalTotal) {
        throw new BadRequestException(
          `Số dư ví tiêu dùng không đủ. Hiện tại: ${balance.toFixed(2)} PV, cần: ${finalTotal.toFixed(2)} PV`,
        );
      }
      user.walletBalance = balance - finalTotal;
      await this.userRepository.save(user);
    }

    // Ví nạp PV (pv_wallet): restamos el saldo en PV (1 PV = 1 USDT en el momento de la compra) y confirmamos el pedido
    if (paymentMethod === 'pv_wallet' && userId) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      
      // Se utiliza una relación directa de 1 PV = 1 USDT para el pago de productos,
      // aplicando la conversión de 1.08 únicamente durante la recarga del saldo PV.
      const requiredPv = finalTotal;
      const pvBalance = Number(user.pvWalletBalance ?? 0);
      if (pvBalance < requiredPv) {
        throw new BadRequestException(
          `Số dư ví nạp PV không đủ. Hiện tại: ${pvBalance.toFixed(2)} PV, cần: ${requiredPv.toFixed(2)} PV`,
        );
      }
      user.pvWalletBalance = pvBalance - requiredPv;
      await this.userRepository.save(user);
    }

    // Determine initial status: Crypto (transactionHash), deposit_wallet or pv_wallet → CONFIRMED; Banking → PENDING
    const initialStatus =
      createOrderDto.transactionHash || paymentMethod === 'deposit_wallet' || paymentMethod === 'pv_wallet'
        ? OrderStatus.CONFIRMED
        : OrderStatus.PENDING;

    const order = this.orderRepository.create({
      userId,
      items,
      totalAmount: finalTotal,
      shippingFee: shippingFee > 0 ? shippingFee : undefined,
      status: initialStatus,
      transactionHash: createOrderDto.transactionHash,
      shippingAddress: createOrderDto.shippingAddress,
      shippingPhone: createOrderDto.shippingPhone,
      shippingName: createOrderDto.shippingName,
      paymentMethod,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Sync to Google Sheets (chỉ lấy thông tin user nếu đã đăng nhập)
    try {
      const user = userId ? await this.userRepository.findOne({ where: { id: userId } }) : undefined;
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

    // Sync to Google Sheets so the sheet gets the transaction hash
    try {
      const user = await this.userRepository.findOne({
        where: { id: order.userId },
      });
      this.googleSheetsService.syncOrder(savedOrder, user || undefined);
    } catch (error) {
      console.error(
        'Failed to sync to Google Sheets after confirmPayment:',
        error,
      );
    }

    return savedOrder;
  }

  /**
   * Encapsulate order approval logic (Stock deduction, Commission, Payout, etc.)
   */
  private async approveOrder(order: Order) {
    // 1. Deduct Stock (grouped by productId to avoid repeated updates)
    await this.updateStockByOrderItems(order, 'decrease');

    // 2. Update buyer's total purchase amount, upgrade package type by threshold, & check reconsumption
    if (order.userId) {
      const user = await this.userRepository.findOne({
        where: { id: order.userId },
      });
      if (user) {
        const amount = Number(order.totalAmount);
        if (Number.isFinite(amount) && amount > 0) {
          await this.userRepository.increment(
            { id: order.userId },
            'totalPurchaseAmount',
            amount,
          );
        }

        // 2b. Upgrade package type when totalPurchaseAmount reaches a package's price (TV → CTV → NPP by level)
        const updatedUser = await this.userRepository.findOne({
          where: { id: order.userId },
        });
        if (updatedUser) {
          const total = Number(updatedUser.totalPurchaseAmount) || 0;
          const packages = await this.packagesService.findAll();
          let highestQualified: { code: string; level: number } | null = null;
          for (const pkg of packages) {
            if (!pkg.isActive) continue;
            const price = Number(pkg.price) ?? 0;
            if (
              total >= price &&
              (highestQualified === null || pkg.level > highestQualified.level)
            ) {
              highestQualified = { code: pkg.code, level: pkg.level };
            }
          }
          if (
            highestQualified &&
            updatedUser.packageType !== highestQualified.code
          ) {
            await this.userRepository.update(order.userId, {
              packageType: highestQualified.code,
            });
          }
        }

        const isReconsumption = await this.checkIfReconsumption(
          user,
          order.totalAmount,
        );

        // Update Order flag
        if (isReconsumption) {
          await this.orderRepository.update(order.id, {
            isReconsumption: true,
          });
        }

        // Update User Reconsumption total
        if (isReconsumption) {
          await this.userRepository.update(order.userId, {
            totalReconsumptionAmount:
              Number(user.totalReconsumptionAmount) + Number(order.totalAmount),
          });
        }
      }
    }

    // 3. Check Milestones for referrer (run here so milestones run even if commission fails)
    const buyer = order.userId
      ? await this.userRepository.findOne({
          where: { id: order.userId },
        })
      : null;
    if (buyer?.referralUserId) {
      this.milestoneRewardService
        .checkAndProcessMilestones(buyer.referralUserId)
        .catch((err) =>
          console.error('[AUTO-CONFIRM] Error processing milestones:', err),
        );
    }

    // 4. Tính hoa hồng — nếu lỗi thì rollback order về PENDING để tránh duyệt thiếu commission
    try {
      await this.commissionService.calculateCommissions(order.id);
      // Sau khi tính xong, tự động payout
      try {
        await this.commissionPayoutService.payoutOrderCommissions(order.id);
        console.log(`[AUTO-CONFIRM] Auto payout completed for order ${order.id}.`);
      } catch (payoutErr) {
        console.error(`[AUTO-CONFIRM] Auto payout failed for order ${order.id}:`, payoutErr);
      }
    } catch (commissionErr) {
      console.error(
        `[AUTO-CONFIRM] Commission calculation failed for order ${order.id} — rolling back to PENDING:`,
        commissionErr,
      );
      // Rollback order về PENDING để admin có thể re-approve sau khi fix
      await this.orderRepository.update(order.id, { status: OrderStatus.PENDING });
      throw new Error(
        `Duyệt đơn thất bại: lỗi tính hoa hồng — ${(commissionErr as any)?.message ?? 'unknown error'}. Đơn hàng đã được rollback về PENDING.`,
      );
    }

    // 5. Matrix reward pool (binary trees per level) — đơn ≥ config USDT
    this.matrixRewardService
      .processOrderIfEligible(order.id)
      .catch((err) =>
        console.error(`[MATRIX] Error processing order ${order.id}:`, err),
      );

    // 6. Heap Reward
    this.heapRewardService
      .processOrderIfEligible(order.id)
      .catch((err) =>
        console.error(`[HEAP] Error processing order ${order.id}:`, err),
      );
  }

  async updateStatus(id: string, updateStatusDto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);
    const oldStatus = order.status;
    const newStatus = updateStatusDto.status as OrderStatus;

    // Nếu chuyển từ PENDING sang CONFIRMED (admin duyệt đơn hàng)
    if (
      oldStatus === OrderStatus.PENDING &&
      newStatus === OrderStatus.CONFIRMED
    ) {
      // Kiểm tra stock lại trước khi duyệt
      const approveItems = this.getOrderItems(order);
      const approveProductMap = await this.getProductsByIds(
        approveItems.map((item) => item.productId),
      );
      for (const item of approveItems) {
        const product = approveProductMap.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
          );
        }
      }

      order.status = newStatus;
      const savedOrder = await this.orderRepository.save(order);

      // Execute approval logic
      await this.approveOrder(savedOrder);

      // Sync to Google Sheets
      const user = order.userId
        ? await this.userRepository.findOne({
            where: { id: order.userId },
          })
        : undefined;
      this.googleSheetsService.syncOrder(savedOrder, user || undefined);

      return savedOrder;
    }

    // Nếu hủy đơn hàng, hoàn lại stock
    if (
      newStatus === OrderStatus.CANCELLED &&
      oldStatus !== OrderStatus.CANCELLED
    ) {
      await this.updateStockByOrderItems(order, 'increase');
    }

    order.status = newStatus;
    const finalSavedOrder = await this.orderRepository.save(order);

    // Sync to Google Sheets
    try {
      const user = order.userId
        ? await this.userRepository.findOne({
            where: { id: order.userId },
          })
        : undefined;
      this.googleSheetsService.syncOrder(finalSavedOrder, user || undefined);
    } catch (error) {
      console.error(
        'Failed to sync to Google Sheets after status update:',
        error,
      );
    }

    return finalSavedOrder;
  }

  async cancelOrder(id: string) {
    const order = await this.findOne(id);
    if (order.status === OrderStatus.DELIVERED) {
      throw new Error('Cannot cancel delivered order');
    }

    // Hoàn lại stock
    await this.updateStockByOrderItems(order, 'increase');

    order.status = OrderStatus.CANCELLED;
    const cancelledOrder = await this.orderRepository.save(order);

    // Sync to Google Sheets
    try {
      const user = order.userId
        ? await this.userRepository.findOne({
            where: { id: order.userId },
          })
        : undefined;
      this.googleSheetsService.syncOrder(cancelledOrder, user || undefined);
    } catch (error) {
      console.error(
        'Failed to sync to Google Sheets after cancellation:',
        error,
      );
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
        const effective = this.packagesService.getEffectiveThreshold(
          Number(user.totalPurchaseAmount),
          pkg,
        );
        if (
          Number(user.totalCommissionReceived) >= effective &&
          orderAmount >= pkg.price
        ) {
          return true;
        }
      }

      return false;
    }

    const pkg = await this.packagesService.findByCode(user.packageType);
    if (!pkg) return false;

    const effective = this.packagesService.getEffectiveThreshold(
      Number(user.totalPurchaseAmount),
      pkg,
    );
    if (
      Number(user.totalCommissionReceived) >= effective &&
      orderAmount >= pkg.price
    ) {
      return true;
    }

    return false;
  }
}
