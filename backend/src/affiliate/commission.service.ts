import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import {
  Commission,
  CommissionType,
  CommissionStatus,
} from './entities/commission.entity';
import { PackagesService } from '../packages/packages.service';
import { Package } from '../packages/entities/package.entity';
import { Product } from '../product/entities/product.entity';

/** Số cấp hoa hồng quản lý: chỉ trả cho 3 parent gần nhất (F1, F2, F3) kể từ người nhận group trở lên. */
const MANAGEMENT_MAX_LEVELS = 3;

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);
  private configCache: Map<string, Package> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
    private packagesService: PackagesService,
  ) { }

  /**
   * Get package config by code (with caching)
   */
  private async getPackageConfig(code: string): Promise<Package | null> {
    if (!code || code === 'NONE') return null;

    const now = Date.now();

    // Check cache
    if (this.configCache.has(code) && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.configCache.get(code)!;
    }

    // Load from database
    const pkg = await this.packagesService.findByCode(code);

    if (pkg) {
      this.configCache.set(code, pkg);
      this.lastCacheUpdate = now;
      return pkg;
    }

    return null;
  }

  /**
   * Default package for users with packageType 'NONE' (e.g. referrer who hasn't bought a package yet).
   * Uses lowest-level active package so referrers still earn direct/group commission.
   */
  private defaultPackageCache: Package | null = null;
  private defaultPackageCacheTime = 0;

  private async getDefaultPackageConfig(): Promise<Package | null> {
    const now = Date.now();
    if (this.defaultPackageCache && (now - this.defaultPackageCacheTime) < this.cacheExpiry) {
      return this.defaultPackageCache;
    }
    const all = await this.packagesService.findAll();
    const defaultPkg = all.filter((p) => p.isActive).shift() || null;
    if (defaultPkg) {
      this.defaultPackageCache = defaultPkg;
      this.defaultPackageCacheTime = now;
    }
    return defaultPkg;
  }

  /**
   * Clear config cache (call when config is updated)
   */
  clearConfigCache(): void {
    this.configCache.clear();
    this.lastCacheUpdate = 0;
    this.defaultPackageCache = null;
    this.defaultPackageCacheTime = 0;
  }

  /**
   * Order value used for commission (excludes shipping fee).
   */
  private getOrderValueForCommission(order: Order): number {
    const total = Number(order.totalAmount) || 0;
    const shipping = Number(order.shippingFee) || 0;
    return Math.max(0, total - shipping);
  }

  /**
   * Tính toán và phân phối hoa hồng khi có đơn hàng mới
   */
  async calculateCommissions(orderId: string): Promise<void> {
    this.logger.log(`Starting commission calculation for order: ${orderId}`);

    try {
      // Kiểm tra xem đã tính commission cho order này chưa (tránh duplicate)
      const existingCommissions = await this.commissionRepository.find({
        where: { orderId },
      });

      if (existingCommissions.length > 0) {
        this.logger.warn(`Commissions already exist for order ${orderId}, skipping calculation`);
        return;
      }

      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });

      if (!order) {
        this.logger.warn(`Order ${orderId} not found`);
        return;
      }

      if (order.status !== OrderStatus.CONFIRMED) {
        this.logger.warn(`Order ${orderId} status is ${order.status}, not CONFIRMED. Skipping commission calculation.`);
        return;
      }

      const buyer = await this.userRepository.findOne({
        where: { id: order.userId },
      });

      if (!buyer) {
        this.logger.warn(`Buyer with userId ${order.userId} not found for order ${orderId}`);
        return;
      }

      const orderValue = this.getOrderValueForCommission(order);
      this.logger.log(`Calculating commissions for order ${orderId}, buyer: ${buyer.id} (referralUserId: ${buyer.referralUserId}, parentId: ${buyer.parentId}), orderValue: ${orderValue} (excl. shipping)`);

      // Package type is only set when user buys a package (not from product purchase).

      // BƯỚC 1: Tính hoa hồng trực tiếp cho người giới thiệu
      this.logger.log(`Step 1: Calculating direct commission for order ${orderId}`);
      await this.calculateDirectCommission(order, buyer);

      // BƯỚC 1b: Hoa hồng product – rate theo từng sản phẩm (admin set % TV/CTV/NPP trong product), trả cho referrer; cộng dồn tới ngưỡng như group/management
      this.logger.log(`Step 1b: Calculating product commission for order ${orderId}`);
      await this.calculateProductCommission(order, buyer);

      // BƯỚC 2: Tính hoa hồng nhóm (cân nhánh – khi có giao dịch từ nhánh yếu, không cần minSale)
      // Tính dựa trên volume hiện tại (trước khi cộng volume của đơn hàng này)
      this.logger.log(`Step 2: Calculating group commission for order ${orderId}`);
      await this.calculateGroupCommission(order, buyer);

      // BƯỚC 3: Update volume cho TẤT CẢ ancestors
      // Update sau khi đã tính commission để volume mới không làm sai lệch logic weakSide
      this.logger.log(`Step 3: Updating branch volumes for order ${orderId}`);
      await this.updateBranchVolumes(order, buyer);

      // BƯỚC 4: Tính hoa hồng quản lý nhóm
      this.logger.log(`Step 4: Calculating management commission for order ${orderId}`);
      await this.calculateManagementCommission(order, buyer);

      this.logger.log(`Commission calculation completed for order ${orderId}`);
    } catch (error: any) {
      // Log error để debug
      this.logger.error(`Error calculating commissions for order ${orderId}:`, error.stack || error.message);
      // Không throw để không block order update, nhưng log để debug
    }
  }

  /**
   * Tính hoa hồng trực tiếp
   */
  private async calculateDirectCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    // Reload buyer từ DB để đảm bảo có referralUserId mới nhất
    const freshBuyer = await this.userRepository.findOne({
      where: { id: buyer.id },
      select: ['id', 'referralUserId'],
    });

    if (!freshBuyer || !freshBuyer.referralUserId) {
      this.logger.debug(`Buyer ${buyer.id} has no referralUserId, skipping direct commission`);
      return; // Không có người giới thiệu ban đầu
    }

    this.logger.log(`Calculating direct commission for buyer ${buyer.id}, referrer: ${freshBuyer.referralUserId}`);

    // Reload referrer từ DB để có data mới nhất
    const referrer = await this.userRepository.findOne({
      where: { id: freshBuyer.referralUserId },
    });

    if (!referrer) {
      return;
    }

    // Only users with a package (CTV, NPP, etc.) receive commission; NONE = no commission
    if (!referrer.packageType || referrer.packageType === 'NONE') {
      this.logger.debug(`Referrer ${referrer.id} has no package (packageType: ${referrer.packageType}), skipping direct commission`);
      return;
    }
    const config = await this.getPackageConfig(referrer.packageType);
    if (!config) {
      this.logger.debug(`No package config for referrer ${referrer.id} (packageType: ${referrer.packageType})`);
      return;
    }

    const orderValue = this.getOrderValueForCommission(order);
    const canReceiveCommission = await this.checkReconsumption(referrer, config);
    const rawCommissionAmount = orderValue * config.directCommissionRate;
    const commissionAmount = this.roundCommission(rawCommissionAmount);

    if (commissionAmount <= 0) {
      this.logger.debug(`Direct commission amount is 0 (rate or order value), skipping create for referrer ${referrer.id}`);
      return;
    }

    this.logger.log(`Creating direct commission: referrer ${referrer.id}, buyer ${buyer.id}, amount: ${commissionAmount}, status: ${canReceiveCommission ? 'PENDING' : 'BLOCKED'}`);

    try {
      const commission = this.commissionRepository.create({
        userId: referrer.id,
        orderId: order.id,
        fromUserId: buyer.id,
        type: CommissionType.DIRECT,
        status: canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
        amount: commissionAmount,
        orderAmount: orderValue,
        notes: canReceiveCommission ? undefined : 'Blocked: Reconsumption required',
      });

      await this.commissionRepository.save(commission);

      if (canReceiveCommission) {
        await this.updateUserCommissionAndCheckThreshold(referrer, commissionAmount, config);
      }
    } catch (error: any) {
      this.logger.error(`Error creating direct commission for referrer ${referrer.id}, buyer ${buyer.id}:`, error.stack || error.message);
      throw error;
    }
  }

  /** Direct: % theo gói người mua (TV/CTV/NPP). */
  private getProductCommissionPercent(product: Product, buyerPackageType: string): number {
    if (!buyerPackageType || buyerPackageType === 'NONE') return 0;
    const code = (buyerPackageType || '').toUpperCase();
    if (code === 'TV') return Number(product.commissionPercentTV) || 0;
    if (code === 'CTV') return Number(product.commissionPercentCTV) || 0;
    if (code === 'NPP') return Number(product.commissionPercentNPP) || 0;
    return 0;
  }

  /** Group: % hoa hồng nhóm theo gói người mua. */
  private getProductCommissionPercentGroup(product: Product, buyerPackageType: string): number {
    if (!buyerPackageType || buyerPackageType === 'NONE') return 0;
    const code = (buyerPackageType || '').toUpperCase();
    if (code === 'TV') return Number(product.commissionPercentGroupTV) || 0;
    if (code === 'CTV') return Number(product.commissionPercentGroupCTV) || 0;
    if (code === 'NPP') return Number(product.commissionPercentGroupNPP) || 0;
    return 0;
  }

  /** Management: % hoa hồng quản lý (F1/F2/F3) khi nguồn là product group, theo gói người mua. */
  private getProductCommissionPercentManagement(product: Product, buyerPackageType: string): number {
    if (!buyerPackageType || buyerPackageType === 'NONE') return 0;
    const code = (buyerPackageType || '').toUpperCase();
    if (code === 'TV') return Number(product.commissionPercentManagementTV) || 0;
    if (code === 'CTV') return Number(product.commissionPercentManagementCTV) || 0;
    if (code === 'NPP') return Number(product.commissionPercentManagementNPP) || 0;
    return 0;
  }

  /**
   * Hoa hồng sản phẩm: tính trên TỪNG SẢN PHẨM riêng biệt (order có 2 sản phẩm → 2 bộ hoa hồng độc lập).
   * Cấu trúc mỗi sản phẩm: Direct (referrer), Group (ancestors cân nhánh), Management (F1/F2/F3 của người nhận product group).
   * Rate lấy từ từng product (TV/CTV/NPP %), base = (price × qty) của dòng đó.
   */
  private async calculateProductCommission(order: Order, buyer: User): Promise<void> {
    const freshBuyer = await this.userRepository.findOne({
      where: { id: buyer.id },
      select: ['id', 'referralUserId', 'packageType'],
    });
    if (!freshBuyer?.referralUserId) {
      this.logger.debug(`[PRODUCT COMMISSION] Buyer ${buyer.id} has no referrer, skipping`);
      return;
    }

    const referrer = await this.userRepository.findOne({
      where: { id: freshBuyer.referralUserId },
    });
    if (!referrer) return;

    if (!referrer.packageType || referrer.packageType === 'NONE') {
      this.logger.debug(`[PRODUCT COMMISSION] Referrer ${referrer.id} has no package, skipping`);
      return;
    }
    const referrerConfig = await this.getPackageConfig(referrer.packageType);
    if (!referrerConfig) return;
    const referrerCanReceive = await this.checkReconsumption(referrer, referrerConfig);

    const ancestors = await this.getAncestors(buyer);
    const items = Array.isArray(order.items) ? order.items : [];

    // Mỗi dòng đơn (sản phẩm) tính hoa hồng riêng — không gộp nhiều sản phẩm
    for (const item of items) {
      if (!item?.productId || typeof item.quantity !== 'number' || typeof item.price !== 'number') continue;

      const product = await this.productRepository.findOne({ where: { id: item.productId } });
      if (!product) continue;
      if (product.useProductCommission === false) {
        this.logger.debug(`[PRODUCT COMMISSION] Product ${product.id} has useProductCommission=false, skipping (uses package commission only)`);
        continue;
      }

      const buyerPkg = freshBuyer.packageType || '';
      const percentDirect = this.getProductCommissionPercent(product, buyerPkg);
      const percentGroup = this.getProductCommissionPercentGroup(product, buyerPkg);

      const itemAmount = Number(item.price) * item.quantity;
      const productNote = (product.name || '').slice(0, 60);

      // --- Product DIRECT: referrer nhận % direct theo sản phẩm
      if (percentDirect > 0) {
        const rawDirect = (itemAmount * percentDirect) / 100;
        const commissionAmount = this.roundCommission(rawDirect);
        if (commissionAmount > 0) {
          const directStatus = referrerCanReceive ? CommissionStatus.PENDING : CommissionStatus.BLOCKED;
          this.logger.log(`[PRODUCT COMMISSION] Direct: Referrer ${referrer.id}, product ${product.name}, ${percentDirect}% of ${itemAmount} = ${commissionAmount}, status=${directStatus}`);

          const directCommission = this.commissionRepository.create({
            userId: referrer.id,
            orderId: order.id,
            fromUserId: buyer.id,
            type: CommissionType.PRODUCT,
            status: directStatus,
            amount: commissionAmount,
            orderAmount: itemAmount,
            notes: directStatus === CommissionStatus.BLOCKED ? 'Blocked: Reconsumption required' : `Product direct: ${productNote}`,
          });
          await this.commissionRepository.save(directCommission);

          if (directStatus === CommissionStatus.PENDING && referrerConfig) {
            await this.updateUserCommissionAndCheckThreshold(referrer, commissionAmount, referrerConfig);
          }
        }
      }

      // --- Product GROUP: ancestors (cùng logic cân nhánh), rate = product group %
      if (percentGroup <= 0) continue;

      const rawGroup = (itemAmount * percentGroup) / 100;
      const groupCommissionAmount = this.roundCommission(rawGroup);
      if (groupCommissionAmount <= 0) continue;

      for (const ancestor of ancestors) {
        if (!ancestor.packageType || ancestor.packageType === 'NONE') continue;
        const ancestorConfig = await this.getPackageConfig(ancestor.packageType);
        if (!ancestorConfig) continue;

        const hasBothBranches = await this.hasBothBranches(ancestor.id);
        if (!hasBothBranches) continue;

        const buyerSide = await this.getBuyerSide(buyer, ancestor);
        const weakSide = await this.getWeakSide(ancestor.id);

        if (Number(ancestor.leftBranchTotal) === 0 && Number(ancestor.rightBranchTotal) === 0) continue;
        if (weakSide !== null && buyerSide !== weakSide) continue;

        const ancestorCanReceive = await this.checkReconsumption(ancestor, ancestorConfig);
        const groupStatus = ancestorCanReceive ? CommissionStatus.PENDING : CommissionStatus.BLOCKED;

        this.logger.log(`[PRODUCT COMMISSION] Group: Ancestor ${ancestor.id}, product ${product.name}, ${percentGroup}% of ${itemAmount} = ${groupCommissionAmount}, status=${groupStatus}`);

        const groupCommission = this.commissionRepository.create({
          userId: ancestor.id,
          orderId: order.id,
          fromUserId: buyer.id,
          type: CommissionType.PRODUCT,
          status: groupStatus,
          amount: groupCommissionAmount,
          orderAmount: itemAmount,
          side: buyerSide,
          notes: groupStatus === CommissionStatus.BLOCKED ? 'Blocked: Reconsumption required' : `Product group: ${productNote}`,
        });
        await this.commissionRepository.save(groupCommission);

        if (groupStatus === CommissionStatus.PENDING) {
          await this.updateUserCommissionAndCheckThreshold(ancestor, groupCommissionAmount, ancestorConfig);
          await this.payManagementFromProductGroupEarner(order, ancestor, groupCommission, product, buyerPkg);
        }
      }
    }
  }

  /**
   * Update volume cho TẤT CẢ ancestors trong binary tree
   */
  private async updateBranchVolumes(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      this.logger.debug(`Buyer ${buyer.id} has no parentId, skipping volume update`);
      return;
    }

    // Tìm tất cả ancestors trong cây nhị phân
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(`Found ${ancestors.length} ancestors for buyer ${buyer.id}`);

    for (const ancestor of ancestors) {
      // Xác định buyer thuộc nhánh nào của ancestor
      const buyerSide = await this.getBuyerSide(buyer, ancestor);

      const orderValue = this.getOrderValueForCommission(order);
      this.logger.log(`Updating volume for ancestor ${ancestor.id}: ${buyerSide} branch increase by ${orderValue}`);

      // Update volume bằng SQL Increment (Atomics) — based on order value excl. shipping
      await this.userRepository.createQueryBuilder()
        .update(User)
        .set({
          [buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: () => `${buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal'} + ${orderValue}`
        })
        .where("id = :id", { id: ancestor.id })
        .execute();
    }
  }

  /**
   * Tính hoa hồng nhóm (binary tree).
   * Quy tắc: Khi giao dịch phát sinh ở nhánh yếu, TẤT CẢ ancestor đều được hoa hồng group (điều kiện: mỗi ancestor có đủ 2 nhánh).
   * Hai nhánh bằng nhau thì nhánh nào phát sinh giao dịch cũng coi là nhánh yếu → vẫn trả. Chỉ không trả khi giao dịch ở nhánh mạnh.
   */
  private async calculateGroupCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(`[GROUP COMMISSION] Processing ${ancestors.length} ancestors for buyer ${buyer.id}`);

    for (const ancestor of ancestors) {
      if (!ancestor.packageType || ancestor.packageType === 'NONE') {
        this.logger.debug(`[GROUP COMMISSION] Ancestor ${ancestor.id} has no package, skipping`);
        continue;
      }
      const config = await this.getPackageConfig(ancestor.packageType);
      if (!config) continue;

      // Điều kiện: 2 nhánh đều có người (có ít nhất 1 con trái và 1 con phải)
      const hasBothBranches = await this.hasBothBranches(ancestor.id);
      if (!hasBothBranches) {
        this.logger.debug(`[GROUP COMMISSION] Ancestor ${ancestor.id} does not have both left and right branches, skipping`);
        continue;
      }

      // Xác định buyer thuộc nhánh nào của ancestor
      const buyerSide = await this.getBuyerSide(buyer, ancestor);

      // Xác định nhánh yếu của ancestor (TRƯỚC khi cộng volume mới)
      const weakSide = await this.getWeakSide(ancestor.id);

      this.logger.log(`[GROUP COMMISSION] Ancestor ${ancestor.id}: buyerSide=${buyerSide}, weakSide=${weakSide} (Current volumes - Left: ${ancestor.leftBranchTotal}, Right: ${ancestor.rightBranchTotal})`);

      // Trả hoa hồng khi: (1) hai nhánh bằng nhau → nhánh nào phát sinh giao dịch cũng coi là nhánh yếu, trả; (2) hoặc giao dịch ở đúng nhánh yếu.
      if (weakSide !== null && buyerSide !== weakSide) {
        this.logger.debug(`[GROUP COMMISSION] Ancestor ${ancestor.id}: order on strong side (buyerSide: ${buyerSide}, weakSide: ${weakSide}), skipping`);
        continue;
      }

      const canReceiveCommission = await this.checkReconsumption(ancestor, config);
      await this.createGroupCommission(
        order,
        buyer,
        ancestor,
        buyerSide,
        canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
        config
      );
    }
  }

  /**
   * Helper function để tạo group commission
   */
  private async createGroupCommission(
    order: Order,
    buyer: User,
    ancestor: User,
    side: 'left' | 'right',
    status: CommissionStatus,
    config: Package
  ): Promise<void> {
    const orderValue = this.getOrderValueForCommission(order);
    const rawCommissionAmount = orderValue * config.groupCommissionRate;
    const commissionAmount = this.roundCommission(rawCommissionAmount);

    if (commissionAmount <= 0) {
      this.logger.debug(`Group commission amount is 0 (groupCommissionRate or order value), skipping create for ancestor ${ancestor.id}`);
      return;
    }

    this.logger.log(`Creating group commission: ancestor ${ancestor.id}, buyer ${buyer.id}, side: ${side}, status: ${status}, amount: ${commissionAmount}`);

    const commission = this.commissionRepository.create({
      userId: ancestor.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.GROUP,
      status: status,
      amount: commissionAmount,
      orderAmount: orderValue,
      side: side,
      notes: status === CommissionStatus.BLOCKED ? 'Blocked: Reconsumption required' : undefined,
    });

    await this.commissionRepository.save(commission);

    if (status === CommissionStatus.PENDING) {
      await this.updateUserCommissionAndCheckThreshold(ancestor, commissionAmount, config);
    }
  }

  /**
   * Tính hoa hồng quản lý: chỉ từ hoa hồng nhóm (group).
   * Chỉ trả cho 3 parent gần nhất (F1, F2, F3) kể từ người nhận group trở lên; mỗi người phải đạt managementMinSales trên cả hai nhánh.
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    // Chỉ hoa hồng nhóm (group), không tính từ milestone
    const groupCommissions = await this.commissionRepository.find({
      where: { orderId: order.id, type: CommissionType.GROUP },
    });

    if (groupCommissions.length === 0) return;

    for (const sourceCommission of groupCommissions) {
      const userA = await this.userRepository.findOne({ where: { id: sourceCommission.userId } });
      if (!userA || !userA.parentId) continue;

      await this.payManagementFromGroupEarner(order, userA, sourceCommission);
    }
  }

  /**
   * Trả hoa hồng quản lý cho đúng 3 parent gần nhất (F1, F2, F3) kể từ A (người nhận group) trở lên.
   * F1 = parent của A, F2 = parent của F1, F3 = parent của F2. Base = amount hoa hồng nhóm của A.
   * Điều kiện bắt buộc: mỗi F1/F2/F3 phải có cả hai nhánh đạt doanh số >= managementMinSales (theo gói).
   */
  private async payManagementFromGroupEarner(
    order: Order,
    userA: User,
    sourceCommission: Commission,
  ): Promise<void> {
    const ancestors = await this.getAncestors(userA); // [F1, F2, F3, ...] từ gần đến xa
    const baseAmount = Number(sourceCommission.amount);

    for (let i = 0; i < Math.min(MANAGEMENT_MAX_LEVELS, ancestors.length); i++) {
      const manager = ancestors[i];
      const level = i + 1; // 1 = F1, 2 = F2, 3 = F3

      const config = await this.getPackageConfig(manager.packageType);
      if (!config) continue;

      // Bắt buộc: mỗi nhánh (trái và phải) của manager phải đạt doanh số >= managementMinSales
      const minSales = Number(config.managementMinSales ?? 0);
      if (minSales > 0) {
        const leftTotal = Number(manager.leftBranchTotal ?? 0);
        const rightTotal = Number(manager.rightBranchTotal ?? 0);
        if (leftTotal < minSales || rightTotal < minSales) {
          this.logger.debug(`[MANAGEMENT] Manager ${manager.id} (F${level}) does not meet managementMinSales $${minSales} per branch (left: $${leftTotal}, right: $${rightTotal}), skipping`);
          continue;
        }
      }

      const canReceiveCommission = await this.checkReconsumption(manager, config);
      let rate = 0;
      if (level === 1) rate = config.managementRateF1;
      else if (level === 2) rate = config.managementRateF2 ?? 0;
      else rate = config.managementRateF3 ?? 0;

      if (rate <= 0) continue;

      const freshManager = await this.userRepository.findOne({ where: { id: manager.id } });
      if (!freshManager) continue;

      await this.createManagementCommission(
        order,
        userA,
        freshManager,
        level,
        baseAmount,
        rate,
        canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
        config,
      );
    }
  }

  /**
   * Trả hoa hồng quản lý cho F1, F2, F3 của A khi nguồn là product group.
   * Dùng % management của sản phẩm (theo gói người mua), áp dụng cùng rate cho F1/F2/F3.
   */
  private async payManagementFromProductGroupEarner(
    order: Order,
    userA: User,
    sourceCommission: Commission,
    product: Product,
    buyerPackageType: string,
  ): Promise<void> {
    const percent = this.getProductCommissionPercentManagement(product, buyerPackageType);
    if (percent <= 0) return;
    const rate = percent / 100; // product stores 0–100, createManagementCommission expects 0–1

    const ancestors = await this.getAncestors(userA);
    const baseAmount = Number(sourceCommission.amount);

    for (let i = 0; i < Math.min(3, ancestors.length); i++) {
      const manager = ancestors[i];
      const level = i + 1;

      const config = await this.getPackageConfig(manager.packageType);
      if (!config) continue;

      const minSales = Number(config.managementMinSales ?? 0);
      if (minSales > 0) {
        const leftTotal = Number(manager.leftBranchTotal ?? 0);
        const rightTotal = Number(manager.rightBranchTotal ?? 0);
        if (leftTotal < minSales || rightTotal < minSales) continue;
      }

      const canReceiveCommission = await this.checkReconsumption(manager, config);
      const freshManager = await this.userRepository.findOne({ where: { id: manager.id } });
      if (!freshManager) continue;

      await this.createManagementCommission(
        order,
        userA,
        freshManager,
        level,
        baseAmount,
        rate,
        canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
        config,
      );
    }
  }

  /**
   * Xác định buyer là F1/F2/F3 của ancestor như thế nào
   */
  private async getGenerationLevel(
    buyer: User,
    ancestor: User,
  ): Promise<number | null> {
    let current: User | null = buyer;
    let level = 0;

    while (current && current.parentId && level < 3) {
      level++;
      if (current.parentId === ancestor.id) {
        return level;
      }
      current = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
    }

    return null;
  }

  private async createManagementCommission(
    order: Order,
    buyer: User,
    manager: User,
    level: number,
    groupCommissionAmount: number,
    rate: number,
    status: CommissionStatus,
    config: Package
  ): Promise<Commission | null> {
    const rawCommissionAmount = groupCommissionAmount * rate;
    const commissionAmount = this.roundCommission(rawCommissionAmount);

    if (commissionAmount <= 0) {
      this.logger.debug(`Management commission amount is 0 (base or rate), skipping create for manager ${manager.id} F${level}`);
      return null;
    }

    const orderValue = this.getOrderValueForCommission(order);
    const commission = this.commissionRepository.create({
      userId: manager.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.MANAGEMENT,
      status: status,
      amount: commissionAmount,
      orderAmount: orderValue,
      level: level,
      notes: status === CommissionStatus.BLOCKED ? 'Blocked: Reconsumption required' : undefined,
    });

    await this.commissionRepository.save(commission);

    if (status === CommissionStatus.PENDING) {
      await this.updateUserCommissionAndCheckThreshold(manager, commissionAmount, config);
    }

    return commission;
  }

  /**
   * Helper to update user commission and check if they reached threshold
   */
  private async updateUserCommissionAndCheckThreshold(user: User, amount: number, config: Package) {
    await this.userRepository.createQueryBuilder()
      .update(User)
      .set({
        totalCommissionReceived: () => `totalCommissionReceived + ${amount}`
      })
      .where("id = :id", { id: user.id })
      .execute();

    // Update logic: Check threshold
    const updatedUser = await this.userRepository.findOne({ where: { id: user.id } });
    if (updatedUser) {
      const newTotalCommission = updatedUser.totalCommissionReceived;
      if (newTotalCommission >= config.reconsumptionThreshold) {
        // Reached threshold -> set packageType to NONE
        await this.userRepository.update(user.id, {
          packageType: 'NONE',
        });
        this.logger.log(`User ${user.id} reached threshold ${config.reconsumptionThreshold}, packageType set to NONE`);
      }
    }
  }

  /**
   * Kiểm tra điều kiện tái tiêu dùng
   * Users with NONE can still receive (e.g. when using default package rates) until they buy a package and hit threshold.
   */
  private async checkReconsumption(user: User, config: Package): Promise<boolean> {
    if (user.packageType === 'NONE') {
      return true; // Allow commission when using default package (referrer who hasn't bought a package yet)
    }

    const threshold = config.reconsumptionThreshold;
    const packageValue = config.price; // Or config.reconsumptionRequired if that logic differs

    // Nếu chưa đạt ngưỡng hoa hồng
    if (user.totalCommissionReceived < threshold) {
      return true;
    }

    // Đã đạt ngưỡng -> BLOCKED (Strict enforcement)
    // Người dùng phải mua gói mới để updateUserPackage kích hoạt logic reset totalCommissionReceived
    return false;
  }

  /**
   * Round commission amount to 2 decimal places (standard for currency).
   * e.g. 36.36 → 36.36, 9.09 → 9.09
   */
  private roundCommission(num: number): number {
    if (num === 0 || !Number.isFinite(num)) return 0;
    return Math.round(num * 100) / 100;
  }

  // --- Helper methods for Tree Traversasl (unchanged logic, just ensuring availability) ---

  private async getAncestors(user: User): Promise<User[]> {
    // Implementation assumes parentId linking up the tree.
    // This part was implicit in original code or assumed imported methods.
    // I will implement a basic version or assume existing private methods if they were in the class.
    // Since I am replacing the whole file, I MUST include these helper methods.

    const ancestors: User[] = [];
    let current = user;
    while (current && current.parentId) {
      const parent = await this.userRepository.findOne({ where: { id: current.parentId } });
      if (parent) {
        ancestors.push(parent);
        current = parent;
      } else {
        break;
      }
    }
    return ancestors;
  }

  private async hasBothBranches(userId: string): Promise<boolean> {
    // Check if user has both left and right children
    // This typically requires checking the 'position' of children
    const children = await this.userRepository.find({ where: { parentId: userId } });
    const hasLeft = children.some(c => c.position === 'left');
    const hasRight = children.some(c => c.position === 'right');
    return hasLeft && hasRight;
  }

  private async getBuyerSide(buyer: User, ancestor: User): Promise<'left' | 'right'> {
    // Traverse up from buyer until we find the child of ancestor
    let current = buyer;
    while (current.parentId && current.parentId !== ancestor.id) {
      const parent = await this.userRepository.findOne({ where: { id: current.parentId } });
      if (!parent) break;
      current = parent;
    }

    // Now current should be a direct child of ancestor
    if (current.parentId === ancestor.id) {
      return current.position ?? 'left'; // guard against null/undefined position
    }

    // Fallback (should not happen if ancestor is valid)
    return 'left';
  }

  private async getWeakSide(userId: string): Promise<'left' | 'right' | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) return null;

    const left = Number(user.leftBranchTotal);
    const right = Number(user.rightBranchTotal);

    if (left < right) return 'left';
    if (right < left) return 'right';
    return null;
  }

  // --- Missing Read/Admin Methods ---

  async getStats(userId: string) {
    const totalCommission = await this.commissionRepository.sum('amount', {
      userId,
      status: CommissionStatus.PAID,
    });

    const pendingCommission = await this.commissionRepository.sum('amount', {
      userId,
      status: CommissionStatus.PENDING,
    });

    const direct = await this.commissionRepository.sum('amount', {
      userId,
      type: CommissionType.DIRECT,
      status: CommissionStatus.PAID,
    });

    const group = await this.commissionRepository.sum('amount', {
      userId,
      type: CommissionType.GROUP,
      status: CommissionStatus.PAID,
    });

    const management = await this.commissionRepository.sum('amount', {
      userId,
      type: CommissionType.MANAGEMENT,
      status: CommissionStatus.PAID,
    });

    return {
      totalCommission: this.roundCommission(totalCommission || 0),
      pendingCommission: this.roundCommission(pendingCommission || 0),
      commissions: {
        direct: this.roundCommission(direct || 0),
        group: this.roundCommission(group || 0),
        management: this.roundCommission(management || 0),
      }
    };
  }

  async getCommissions(
    userId: string,
    query: { type?: CommissionType; status?: CommissionStatus },
  ) {
    const where: any = { userId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const commissions = await this.commissionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['fromUser'],
    });

    return commissions.map(c => ({
      ...c,
      amount: this.roundCommission(Number(c.amount)),
    }));
  }

  async getAllCommissions(query: {
    type?: CommissionType;
    status?: CommissionStatus;
    userId?: string;
  }) {
    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = query.userId;

    const commissions = await this.commissionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['user', 'fromUser'],
    });

    return commissions.map(c => ({
      ...c,
      amount: this.roundCommission(Number(c.amount)),
    }));
  }

  async approveCommission(commissionId: string, notes?: string) {
    const commission = await this.commissionRepository.findOne({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    if (commission.status !== CommissionStatus.PENDING) {
      throw new Error('Commission status is not PENDING');
    }

    commission.status = CommissionStatus.PAID;
    if (notes) commission.notes = notes;

    return this.commissionRepository.save(commission);
  }

  async approveCommissions(commissionIds: string[]) {
    // This assumes straightforward approval. Ideally transactional.
    const results: Commission[] = [];
    for (const id of commissionIds) {
      try {
        const result = await this.approveCommission(id);
        results.push(result);
      } catch (error) {
        // Log or handle individual failure
        this.logger.error(`Failed to approve commission ${id}`, error);
      }
    }
    return results;
  }

  async getCommissionDetail(commissionId: string) {
    return this.commissionRepository.findOne({
      where: { id: commissionId },
      relations: ['user', 'fromUser', 'order'],
    });
  }

  async awardMilestoneReward(
    userId: string,
    amount: number,
    milestoneId: string,
  ): Promise<Commission> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Check package config for threshold logic
    let canReceive = true;
    let notes: string | undefined = undefined;

    if (user.packageType !== 'NONE') {
      const config = await this.getPackageConfig(user.packageType);
      if (config) {
        canReceive = await this.checkReconsumption(user, config);
        if (!canReceive) {
          notes = 'Blocked: Reconsumption required';
        }
      }
    }

    const commission = this.commissionRepository.create({
      userId,
      amount,
      type: CommissionType.MILESTONE,
      status: canReceive ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
      notes: notes || `Milestone Reward #${milestoneId}`,
      orderAmount: 0,
      orderId: null,
      milestoneRef: `milestone-${milestoneId}`,
    });

    await this.commissionRepository.save(commission);

    if (canReceive) {
      // Update user total commission
      // Note: For MILESTONE rewards, checkReconsumption logic applies similarly
      // If packageType is valid, we check threshold.
      if (user.packageType !== 'NONE') {
        const config = await this.getPackageConfig(user.packageType);
        if (config) {
          await this.updateUserCommissionAndCheckThreshold(user, amount, config);
        } else {
          // Should not happen if user.packageType is not NONE
          // Just update commission total
          await this.userRepository.createQueryBuilder()
            .update(User)
            .set({ totalCommissionReceived: () => `totalCommissionReceived + ${amount}` })
            .where("id = :id", { id: userId })
            .execute();
        }
      } else {
        // If NONE, just update total (they might be blocked anyway but records are kept)
        await this.userRepository.createQueryBuilder()
          .update(User)
          .set({ totalCommissionReceived: () => `totalCommissionReceived + ${amount}` })
          .where("id = :id", { id: userId })
          .execute();
      }
    }

    return commission;
  }
}
