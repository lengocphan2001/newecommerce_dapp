import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
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
  ) {}

  /**
   * Get package config by code (with caching)
   */
  private async getPackageConfig(code: string): Promise<Package | null> {
    if (!code || code === 'NONE') return null;

    const now = Date.now();

    // Check cache
    if (
      this.configCache.has(code) &&
      now - this.lastCacheUpdate < this.cacheExpiry
    ) {
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
    if (
      this.defaultPackageCache &&
      now - this.defaultPackageCacheTime < this.cacheExpiry
    ) {
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
        this.logger.warn(
          `Commissions already exist for order ${orderId}, skipping calculation`,
        );
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
        this.logger.warn(
          `Order ${orderId} status is ${order.status}, not CONFIRMED. Skipping commission calculation.`,
        );
        return;
      }

      const buyer = await this.userRepository.findOne({
        where: { id: order.userId },
      });

      if (!buyer) {
        this.logger.warn(
          `Buyer with userId ${order.userId} not found for order ${orderId}`,
        );
        return;
      }

      const orderValue = this.getOrderValueForCommission(order);
      this.logger.log(
        `Calculating commissions for order ${orderId}, buyer: ${buyer.id} (referralUserId: ${buyer.referralUserId}, parentId: ${buyer.parentId}), orderValue: ${orderValue} (excl. shipping)`,
      );

      // Package type is only set when user buys a package (not from product purchase).

      const productMap = await this.getOrderProductsMap(order);

      // BƯỚC 1: Hoa hồng trực tiếp theo gói — chỉ các dòng useProductCommission = false
      this.logger.log(
        `Step 1: Calculating direct commission for order ${orderId}`,
      );
      await this.calculateDirectCommission(order, buyer, productMap);

      // BƯỚC 1b: Hoa hồng sản phẩm — chỉ các dòng useProductCommission = true
      this.logger.log(
        `Step 1b: Calculating product commission for order ${orderId}`,
      );
      await this.calculateProductCommission(order, buyer, productMap);

      // BƯỚC 2: Hoa hồng nhóm theo gói — chỉ các dòng useProductCommission = false
      this.logger.log(
        `Step 2: Calculating group commission for order ${orderId}`,
      );
      await this.calculateGroupCommission(order, buyer, productMap);

      // BƯỚC 3: Tính hoa hồng quản lý nhóm (dựa trên volume hiện tại, chưa cộng đơn này)
      this.logger.log(
        `Step 3: Calculating management commission for order ${orderId}`,
      );
      await this.calculateManagementCommission(order, buyer);

      // BƯỚC 4: Update volume cho TẤT CẢ ancestors
      // Update sau khi đã tính commission để đơn hiện tại không làm thay đổi điều kiện managementMinSales
      this.logger.log(`Step 4: Updating branch volumes for order ${orderId}`);
      await this.updateBranchVolumes(order, buyer);

      this.logger.log(`Commission calculation completed for order ${orderId}`);
    } catch (error: any) {
      // Log toàn bộ thông tin lỗi để debug — bao gồm SQL, error code, stack trace
      this.logger.error(
        `Error calculating commissions for order ${orderId}: ${error?.message ?? 'unknown error'}`,
      );
      if (error?.stack) {
        this.logger.error(`Stack: ${error.stack}`);
      }
      if (error?.sql) {
        this.logger.error(`Failed SQL: ${error.sql}`);
      }
      if (error?.sqlMessage) {
        this.logger.error(`SQL message: ${error.sqlMessage} (code: ${error?.code ?? 'N/A'})`);
      }
      // Ném lại lỗi để caller biết commission thất bại và có thể rollback
      throw error;
    }
  }

  private async getOrderProductsMap(order: Order): Promise<Map<string, Product>> {
    const items = Array.isArray(order.items) ? order.items : [];
    const productIds = [
      ...new Set(
        items
          .map((item) => item?.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (productIds.length === 0) return new Map();
    const products = await this.productRepository.find({
      where: { id: In(productIds) },
    });
    return new Map(products.map((product) => [product.id, product]));
  }

  /**
   * Hoa hồng trực tiếp theo gói referrer — chỉ tính trên các dòng useProductCommission = false.
   */
  private async calculateDirectCommission(
    order: Order,
    buyer: User,
    preloadedProductMap?: Map<string, Product>,
  ): Promise<void> {
    const freshBuyer = await this.userRepository.findOne({
      where: { id: buyer.id },
      select: ['id', 'referralUserId'],
    });

    if (!freshBuyer || !freshBuyer.referralUserId) {
      this.logger.debug(
        `Buyer ${buyer.id} has no referralUserId, skipping direct commission`,
      );
      return;
    }

    const referrer = await this.userRepository.findOne({
      where: { id: freshBuyer.referralUserId },
    });

    if (!referrer) return;

    if (!referrer.packageType || referrer.packageType === 'NONE') {
      this.logger.debug(
        `Referrer ${referrer.id} has no package, skipping direct commission`,
      );
      return;
    }

    const config = await this.getPackageConfig(referrer.packageType);
    if (!config) return;

    const items = Array.isArray(order.items) ? order.items : [];
    const productMap = preloadedProductMap ?? (await this.getOrderProductsMap(order));
    let packageOrderValue = 0;
    for (const item of items) {
      if (
        !item?.productId ||
        typeof item.quantity !== 'number' ||
        typeof item.price !== 'number'
      )
        continue;
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (product.useProductCommission === true) continue;
      packageOrderValue += Number(item.price) * item.quantity;
    }

    if (packageOrderValue <= 0) {
      this.logger.debug(
        `No package-based order lines for direct commission, skipping`,
      );
      return;
    }

    const canReceiveCommission = await this.checkReconsumption(
      referrer,
      config,
    );
    const rawCommissionAmount = packageOrderValue * config.directCommissionRate;
    const commissionAmount = this.roundCommission(rawCommissionAmount);

    if (commissionAmount <= 0) return;

    const directStatus = canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED;
    this.logger.log(
      `Creating direct commission (package config): referrer ${referrer.id}, packageOrderValue: ${packageOrderValue}, amount: ${commissionAmount}, status: ${directStatus}, reconsumptionEligible: ${canReceiveCommission}`,
    );

    try {
      const commission = this.commissionRepository.create({
        userId: referrer.id,
        orderId: order.id,
        fromUserId: buyer.id,
        type: CommissionType.DIRECT,
        status: directStatus,
        amount: commissionAmount,
        orderAmount: packageOrderValue,
        notes: canReceiveCommission
          ? undefined
          : 'Reconsumption required - keep pending, do not approve',
      });
      await this.commissionRepository.save(commission);

      if (canReceiveCommission) {
        await this.updateUserCommissionAndCheckThreshold(
          referrer,
          commissionAmount,
          config,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Error creating direct commission for referrer ${referrer.id}:`,
        error.stack || error.message,
      );
      throw error;
    }
  }

  /** Cấu hình hoa hồng sản phẩm cho một gói: từ commissionConfigByPackage[code] (cùng form Package) hoặc từ các trường phẳng cũ. */
  /** Config dùng cho hoa hồng sản phẩm (useProductCommission = true). Bao gồm reconsumption để không phụ thuộc Package. */
  private getProductCommissionConfigForPackage(
    product: Product,
    packageCode: string,
  ): {
    directCommissionRate: number;
    groupCommissionRate: number;
    groupCommissionMinSales: number;
    managementRateF1: number;
    managementRateF2: number;
    managementRateF3: number;
    managementMinSales: number;
    reconsumptionThreshold: number;
    reconsumptionRequired: number;
  } | null {
    const code = (packageCode || '').toUpperCase();
    if (!code || code === 'NONE') return null;
    const byPkg =
      product.commissionConfigByPackage &&
      product.commissionConfigByPackage[code];
    if (byPkg && typeof byPkg === 'object') {
      return {
        directCommissionRate: Number(byPkg.directCommissionRate ?? 0),
        groupCommissionRate: Number(byPkg.groupCommissionRate ?? 0),
        groupCommissionMinSales: Number(byPkg.groupCommissionMinSales ?? 0),
        managementRateF1: Number(byPkg.managementRateF1 ?? 0),
        managementRateF2: Number(byPkg.managementRateF2 ?? 0),
        managementRateF3: Number(byPkg.managementRateF3 ?? 0),
        managementMinSales: Number(byPkg.managementMinSales ?? 0),
        reconsumptionThreshold: Number(
          byPkg.reconsumptionThreshold ?? product.reconsumptionThreshold ?? 0,
        ),
        reconsumptionRequired: Number(
          byPkg.reconsumptionRequired ?? product.reconsumptionRequired ?? 0,
        ),
      };
    }
    const directPct = this.getProductCommissionPercent(product, packageCode);
    const groupPct = this.getProductCommissionPercentGroup(
      product,
      packageCode,
    );
    const mgmtPct = this.getProductCommissionPercentManagement(
      product,
      packageCode,
    );
    return {
      directCommissionRate: directPct / 100,
      groupCommissionRate: groupPct / 100,
      groupCommissionMinSales: Number(product.groupCommissionMinSales ?? 0),
      managementRateF1: mgmtPct / 100,
      managementRateF2: mgmtPct / 100,
      managementRateF3: mgmtPct / 100,
      managementMinSales: Number(product.managementMinSales ?? 0),
      reconsumptionThreshold: Number(product.reconsumptionThreshold ?? 0),
      reconsumptionRequired: Number(product.reconsumptionRequired ?? 0),
    };
  }

  /** Direct: % theo gói người mua (TV/CTV/NPP). Fallback khi không dùng commissionConfigByPackage. */
  private getProductCommissionPercent(
    product: Product,
    buyerPackageType: string,
  ): number {
    if (!buyerPackageType || buyerPackageType === 'NONE') return 0;
    const code = (buyerPackageType || '').toUpperCase();
    if (code === 'TV') return Number(product.commissionPercentTV) || 0;
    if (code === 'CTV') return Number(product.commissionPercentCTV) || 0;
    if (code === 'NPP') return Number(product.commissionPercentNPP) || 0;
    return 0;
  }

  /** Group: % hoa hồng nhóm theo gói người mua. */
  private getProductCommissionPercentGroup(
    product: Product,
    buyerPackageType: string,
  ): number {
    if (!buyerPackageType || buyerPackageType === 'NONE') return 0;
    const code = (buyerPackageType || '').toUpperCase();
    if (code === 'TV') return Number(product.commissionPercentGroupTV) || 0;
    if (code === 'CTV') return Number(product.commissionPercentGroupCTV) || 0;
    if (code === 'NPP') return Number(product.commissionPercentGroupNPP) || 0;
    return 0;
  }

  /** Management: % hoa hồng quản lý (F1/F2/F3) khi nguồn là product group, theo gói người mua. */
  private getProductCommissionPercentManagement(
    product: Product,
    buyerPackageType: string,
  ): number {
    if (!buyerPackageType || buyerPackageType === 'NONE') return 0;
    const code = (buyerPackageType || '').toUpperCase();
    if (code === 'TV')
      return Number(product.commissionPercentManagementTV) || 0;
    if (code === 'CTV')
      return Number(product.commissionPercentManagementCTV) || 0;
    if (code === 'NPP')
      return Number(product.commissionPercentManagementNPP) || 0;
    return 0;
  }

  /**
   * Hoa hồng sản phẩm: tính trên TỪNG SẢN PHẨM riêng biệt (order có 2 sản phẩm → 2 bộ hoa hồng độc lập).
   * Cấu trúc mỗi sản phẩm: Direct (referrer), Group (ancestors cân nhánh), Management (F1/F2/F3 của người nhận product group).
   * Rate lấy từ từng product (TV/CTV/NPP %), base = (price × qty) của dòng đó.
   */
  private async calculateProductCommission(
    order: Order,
    buyer: User,
    preloadedProductMap?: Map<string, Product>,
  ): Promise<void> {
    const freshBuyer = await this.userRepository.findOne({
      where: { id: buyer.id },
      select: ['id', 'referralUserId', 'packageType'],
    });
    if (!freshBuyer?.referralUserId) {
      this.logger.debug(
        `[PRODUCT COMMISSION] Buyer ${buyer.id} has no referrer, skipping`,
      );
      return;
    }

    const referrer = await this.userRepository.findOne({
      where: { id: freshBuyer.referralUserId },
    });
    if (!referrer) return;

    if (!referrer.packageType || referrer.packageType === 'NONE') {
      this.logger.debug(
        `[PRODUCT COMMISSION] Referrer ${referrer.id} has no package, skipping`,
      );
      return;
    }

    const ancestors = await this.getAncestors(buyer);
    const items = Array.isArray(order.items) ? order.items : [];
    const productMap = preloadedProductMap ?? (await this.getOrderProductsMap(order));
    const productGroupAmountByAncestorId = new Map<string, number>();
    let firstProductGroupMeta: { product: Product; buyerPkg: string } | null =
      null;

    // Mỗi dòng đơn (sản phẩm) tính hoa hồng riêng — config từ tab "Hoa hồng sản phẩm" khi useProductCommission = true
    for (const item of items) {
      if (
        !item?.productId ||
        typeof item.quantity !== 'number' ||
        typeof item.price !== 'number'
      )
        continue;

      const product = productMap.get(item.productId);
      if (!product) continue;
      if (product.useProductCommission === false) {
        this.logger.debug(
          `[PRODUCT COMMISSION] Product ${product.id} has useProductCommission=false, skipping (uses package commission only)`,
        );
        continue;
      }

      const buyerPkg = freshBuyer.packageType || '';
      const referrerProductConfig = this.getProductCommissionConfigForPackage(
        product,
        referrer.packageType || '',
      );
      const directRate = referrerProductConfig
        ? referrerProductConfig.directCommissionRate
        : this.getProductCommissionPercent(product, buyerPkg) / 100;
      const itemAmount = Number(item.price) * item.quantity;
      const productNote = (product.name || '').slice(0, 60);

      // --- Product DIRECT: chỉ dùng config sản phẩm (reconsumption từ product, không dùng Package)
      if (directRate > 0) {
        const referrerCanReceive =
          await this.checkReconsumptionWithProductConfig(
            referrer,
            referrerProductConfig,
          );
        const rawDirect = itemAmount * directRate;
        const commissionAmount = this.roundCommission(rawDirect);
        if (commissionAmount > 0) {
          const directStatus = referrerCanReceive ? CommissionStatus.PENDING : CommissionStatus.BLOCKED;
          this.logger.log(
            `[PRODUCT COMMISSION] Direct: Referrer ${referrer.id}, product ${product.name}, rate ${directRate} of ${itemAmount} = ${commissionAmount}, status=${directStatus}`,
          );

          const directCommission = this.commissionRepository.create({
            userId: referrer.id,
            orderId: order.id,
            fromUserId: buyer.id,
            type: CommissionType.PRODUCT,
            status: directStatus,
            amount: commissionAmount,
            orderAmount: itemAmount,
            notes:
              referrerCanReceive
                ? `Product direct: ${productNote}`
                : 'Reconsumption required - keep pending, do not approve',
          });
          await this.commissionRepository.save(directCommission);

          if (
            referrerCanReceive && referrerProductConfig
          ) {
            await this.updateUserCommissionAndCheckThresholdWithProductConfig(
              referrer,
              commissionAmount,
              referrerProductConfig,
            );
          }
        }
      }

      // --- Product GROUP: chỉ dùng config sản phẩm (reconsumption từ product, không dùng Package)
      for (const ancestor of ancestors) {
        if (!ancestor.packageType || ancestor.packageType === 'NONE') continue;
        const ancestorProductConfig = this.getProductCommissionConfigForPackage(
          product,
          ancestor.packageType,
        );
        const groupRate = ancestorProductConfig
          ? ancestorProductConfig.groupCommissionRate
          : this.getProductCommissionPercentGroup(product, buyerPkg) / 100;
        if (groupRate <= 0) continue;

        const rawGroup = itemAmount * groupRate;
        const groupCommissionAmount = this.roundCommission(rawGroup);
        if (groupCommissionAmount <= 0) continue;

        const hasBothBranches = this.hasBothBranchesFromUser(ancestor);
        if (!hasBothBranches) continue;

        // Min branch sales chỉ áp dụng cho hoa hồng quản lý (management), không áp dụng cho hoa hồng cân nhánh (product group).

        const buyerSide = await this.getBuyerSide(buyer, ancestor);
        const weakSide = this.getWeakSideFromUser(ancestor);

        if (
          Number(ancestor.leftBranchTotal) === 0 &&
          Number(ancestor.rightBranchTotal) === 0
        )
          continue;
        if (weakSide !== null && buyerSide !== weakSide) continue;

        const ancestorCanReceive =
          await this.checkReconsumptionWithProductConfig(
            ancestor,
            ancestorProductConfig,
          );
        const groupStatus = ancestorCanReceive ? CommissionStatus.PENDING : CommissionStatus.BLOCKED;

        this.logger.log(
          `[PRODUCT COMMISSION] Group: Ancestor ${ancestor.id}, product ${product.name}, rate ${groupRate} of ${itemAmount} = ${groupCommissionAmount}, status=${groupStatus}`,
        );

        const groupCommission = this.commissionRepository.create({
          userId: ancestor.id,
          orderId: order.id,
          fromUserId: buyer.id,
          type: CommissionType.PRODUCT,
          status: groupStatus,
          amount: groupCommissionAmount,
          orderAmount: itemAmount,
          side: buyerSide,
          notes:
            ancestorCanReceive
              ? `Product group: ${productNote}`
              : 'Reconsumption required - keep pending, do not approve',
        });
        await this.commissionRepository.save(groupCommission);

        const prev = productGroupAmountByAncestorId.get(ancestor.id) ?? 0;
        productGroupAmountByAncestorId.set(
          ancestor.id,
          prev + groupCommissionAmount,
        );
        if (!firstProductGroupMeta)
          firstProductGroupMeta = { product, buyerPkg };

        if (ancestorCanReceive && ancestorProductConfig) {
          await this.updateUserCommissionAndCheckThresholdWithProductConfig(
            ancestor,
            groupCommissionAmount,
            ancestorProductConfig,
          );
        }
      }
    }

    // Hoa hồng quản lý từ product group: F1/F2/F3 của người nhận product group, theo % trong tab Hoa hồng sản phẩm
    const earner = ancestors.find((a) =>
      productGroupAmountByAncestorId.has(a.id),
    );
    if (earner && firstProductGroupMeta) {
      const totalProductGroupAmount =
        productGroupAmountByAncestorId.get(earner.id) ?? 0;
      if (totalProductGroupAmount > 0) {
        const syntheticSource = this.commissionRepository.create({
          userId: earner.id,
          orderId: order.id,
          fromUserId: buyer.id,
          type: CommissionType.PRODUCT,
          status: CommissionStatus.PENDING,
          amount: totalProductGroupAmount,
          orderAmount: totalProductGroupAmount,
          notes: 'Product group (aggregated for management)',
        });
        await this.payManagementFromProductGroupEarner(
          order,
          earner,
          syntheticSource,
          firstProductGroupMeta.product,
          firstProductGroupMeta.buyerPkg,
        );
      }
    }
  }

  /**
   * Update volume cho TẤT CẢ ancestors trong binary tree
   */
  private async updateBranchVolumes(order: Order, buyer: User): Promise<void> {
    if (!buyer.parentId) {
      this.logger.debug(
        `Buyer ${buyer.id} has no parentId, skipping volume update`,
      );
      return;
    }

    // Tìm tất cả ancestors trong cây nhị phân
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(
      `Found ${ancestors.length} ancestors for buyer ${buyer.id}`,
    );

    for (const ancestor of ancestors) {
      // Xác định buyer thuộc nhánh nào của ancestor
      const buyerSide = await this.getBuyerSide(buyer, ancestor);

      const orderValue = this.getOrderValueForCommission(order);
      this.logger.log(
        `Updating volume for ancestor ${ancestor.id}: ${buyerSide} branch increase by ${orderValue}`,
      );

      // Update volume bằng SQL Increment (Atomics) — based on order value excl. shipping
      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({
          [buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: () =>
            `${buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal'} + ${orderValue}`,
        })
        .where('id = :id', { id: ancestor.id })
        .execute();
    }
  }

  /**
   * Hoa hồng nhóm theo gói — chỉ tính trên các dòng useProductCommission = false.
   */
  private async calculateGroupCommission(
    order: Order,
    buyer: User,
    preloadedProductMap?: Map<string, Product>,
  ): Promise<void> {
    const items = Array.isArray(order.items) ? order.items : [];
    const productMap = preloadedProductMap ?? (await this.getOrderProductsMap(order));
    let packageOrderValue = 0;
    for (const item of items) {
      if (
        !item?.productId ||
        typeof item.quantity !== 'number' ||
        typeof item.price !== 'number'
      )
        continue;
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (product.useProductCommission === true) continue;
      packageOrderValue += Number(item.price) * item.quantity;
    }

    if (packageOrderValue <= 0) {
      this.logger.debug(
        `[GROUP COMMISSION] No package-based order lines, skipping`,
      );
      return;
    }

    const ancestors = await this.getAncestors(buyer);
    this.logger.log(
      `[GROUP COMMISSION] Processing ${ancestors.length} ancestors for buyer ${buyer.id}, packageOrderValue: ${packageOrderValue}`,
    );

    for (const ancestor of ancestors) {
      if (!ancestor.packageType || ancestor.packageType === 'NONE') {
        this.logger.debug(
          `[GROUP COMMISSION] Ancestor ${ancestor.id} has no package, skipping`,
        );
        continue;
      }
      const config = await this.getPackageConfig(ancestor.packageType);
      if (!config) continue;

      const hasBothBranches = this.hasBothBranchesFromUser(ancestor);
      if (!hasBothBranches) {
        this.logger.debug(
          `[GROUP COMMISSION] Ancestor ${ancestor.id} does not have both branches, skipping`,
        );
        continue;
      }

      // Min branch sales chỉ áp dụng cho hoa hồng quản lý (management), không áp dụng cho hoa hồng cân nhánh (group).

      const buyerSide = await this.getBuyerSide(buyer, ancestor);
      const weakSide = this.getWeakSideFromUser(ancestor);

      if (weakSide !== null && buyerSide !== weakSide) {
        this.logger.debug(
          `[GROUP COMMISSION] Ancestor ${ancestor.id}: order on strong side, skipping`,
        );
        continue;
      }

      const canReceiveCommission = await this.checkReconsumption(
        ancestor,
        config,
      );
      await this.createGroupCommission(
        order,
        buyer,
        ancestor,
        buyerSide,
        packageOrderValue,
        canReceiveCommission,
        config,
      );
    }
  }

  /**
   * Helper function để tạo group commission (baseAmount = giá trị đơn dùng cho hoa hồng nhóm, thường là packageOrderValue).
   */
  private async createGroupCommission(
    order: Order,
    buyer: User,
    ancestor: User,
    side: 'left' | 'right',
    baseAmount: number,
    canReceiveCommission: boolean,
    config: Package,
  ): Promise<void> {
    const rawCommissionAmount = baseAmount * config.groupCommissionRate;
    const commissionAmount = this.roundCommission(rawCommissionAmount);

    if (commissionAmount <= 0) {
      this.logger.debug(
        `Group commission amount is 0 (groupCommissionRate or order value), skipping create for ancestor ${ancestor.id}`,
      );
      return;
    }

    this.logger.log(
      `Creating group commission: ancestor ${ancestor.id}, buyer ${buyer.id}, side: ${side}, canReceive: ${canReceiveCommission}, amount: ${commissionAmount}`,
    );

    const commission = this.commissionRepository.create({
      userId: ancestor.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.GROUP,
      status: canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
      amount: commissionAmount,
      orderAmount: baseAmount,
      side: side,
      notes:
        canReceiveCommission
          ? undefined
          : 'Reconsumption required - keep pending, do not approve',
    });

    await this.commissionRepository.save(commission);

    if (canReceiveCommission) {
      await this.updateUserCommissionAndCheckThreshold(
        ancestor,
        commissionAmount,
        config,
      );
    }
  }

  /**
   * Tính hoa hồng quản lý: chỉ từ hoa hồng nhóm (group).
   * Tối đa 3 management per order (F1, F2, F3). Chỉ lấy MỘT group earner (người nhận group gần buyer nhất) để trả F1/F2/F3.
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    const groupCommissions = await this.commissionRepository.find({
      where: { orderId: order.id, type: CommissionType.GROUP },
    });

    if (groupCommissions.length === 0) return;

    // Chỉ dùng 1 group earner → tối đa 3 management (F1, F2, F3) cho cả order.
    // Rule cố định: chọn ancestor gần buyer nhất có nhận group commission trong order.
    const ancestors = await this.getAncestors(buyer); // gần -> xa
    const groupCommissionByUserId = new Map(
      groupCommissions.map((commission) => [commission.userId, commission]),
    );
    const nearestAncestorEarner = ancestors.find((ancestor) =>
      groupCommissionByUserId.has(ancestor.id),
    );
    if (!nearestAncestorEarner) return;

    const sourceCommission = groupCommissionByUserId.get(nearestAncestorEarner.id);
    if (!sourceCommission) return;

    const userA = await this.userRepository.findOne({
      where: { id: nearestAncestorEarner.id },
    });
    if (!userA || !userA.parentId) return;

    await this.payManagementFromGroupEarner(order, userA, sourceCommission);
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

    for (
      let i = 0;
      i < Math.min(MANAGEMENT_MAX_LEVELS, ancestors.length);
      i++
    ) {
      const manager = ancestors[i];
      const level = i + 1; // 1 = F1, 2 = F2, 3 = F3

      // Luôn lấy gói từ DB (không cache) để dùng đúng managementMinSales mới nhất
      const config = await this.packagesService.findByCode(
        manager.packageType || '',
      );
      if (!config) continue;

      // Bắt buộc: mỗi nhánh (trái và phải) của manager phải đạt doanh số >= managementMinSales (theo gói)
      const minSales = Number(config.managementMinSales ?? 0);
      if (minSales > 0) {
        // Đọc lại manager từ DB để có left/right branch totals mới nhất
        const freshManager = await this.userRepository.findOne({
          where: { id: manager.id },
          select: ['id', 'leftBranchTotal', 'rightBranchTotal'],
        });
        const leftTotal = Number(freshManager?.leftBranchTotal ?? 0);
        const rightTotal = Number(freshManager?.rightBranchTotal ?? 0);
        if (leftTotal < minSales || rightTotal < minSales) {
          this.logger.log(
            `[MANAGEMENT] Manager ${manager.id} (F${level}) does not meet managementMinSales $${minSales} per branch (left: $${leftTotal}, right: $${rightTotal}), skipping`,
          );
          continue;
        }
      }

      const canReceiveCommission = await this.checkReconsumption(
        manager,
        config,
      );
      let rate = 0;
      if (level === 1) rate = config.managementRateF1;
      else if (level === 2) rate = config.managementRateF2 ?? 0;
      else rate = config.managementRateF3 ?? 0;

      if (rate <= 0) continue;

      const freshManager = await this.userRepository.findOne({
        where: { id: manager.id },
      });
      if (!freshManager) continue;

      await this.createManagementCommission(
        order,
        userA,
        freshManager,
        level,
        baseAmount,
        rate,
        canReceiveCommission,
        config,
      );
    }
  }

  /**
   * Trả hoa hồng quản lý cho F1, F2, F3 của A khi nguồn là product group.
   * Dùng config từ commissionConfigByPackage[buyerPackageType] (cùng form Package) hoặc từ trường phẳng sản phẩm.
   */
  private async payManagementFromProductGroupEarner(
    order: Order,
    userA: User,
    sourceCommission: Commission,
    product: Product,
    buyerPackageType: string,
  ): Promise<void> {
    const productConfig = this.getProductCommissionConfigForPackage(
      product,
      buyerPackageType,
    );
    const ancestors = await this.getAncestors(userA);
    const baseAmount = Number(sourceCommission.amount);
    const productMinSales = productConfig
      ? productConfig.managementMinSales
      : Number(product.managementMinSales ?? 0);

    for (let i = 0; i < Math.min(3, ancestors.length); i++) {
      const manager = ancestors[i];
      const level = i + 1;

      let rate = 0;
      if (productConfig) {
        if (level === 1) rate = productConfig.managementRateF1;
        else if (level === 2) rate = productConfig.managementRateF2;
        else rate = productConfig.managementRateF3;
      }
      if (rate <= 0) {
        const percentByPkg = this.getProductCommissionPercentManagement(
          product,
          buyerPackageType,
        );
        rate = percentByPkg / 100;
      }
      if (rate <= 0) continue;

      // Chỉ dùng config sản phẩm (theo gói của manager), không dùng Package
      const managerProductConfig = this.getProductCommissionConfigForPackage(
        product,
        manager.packageType || '',
      );

      const minSales =
        productMinSales > 0
          ? productMinSales
          : managerProductConfig
            ? managerProductConfig.managementMinSales
            : 0;
      if (minSales > 0) {
        const freshManager = await this.userRepository.findOne({
          where: { id: manager.id },
          select: ['id', 'leftBranchTotal', 'rightBranchTotal'],
        });
        const leftTotal = Number(freshManager?.leftBranchTotal ?? 0);
        const rightTotal = Number(freshManager?.rightBranchTotal ?? 0);
        if (leftTotal < minSales || rightTotal < minSales) continue;
      }

      const canReceiveCommission =
        await this.checkReconsumptionWithProductConfig(
          manager,
          managerProductConfig,
        );
      const freshManager = await this.userRepository.findOne({
        where: { id: manager.id },
      });
      if (!freshManager) continue;

      await this.createManagementCommission(
        order,
        userA,
        freshManager,
        level,
        baseAmount,
        rate,
        canReceiveCommission,
        null as any,
        {
          fromProductGroup: true,
          productReconsumptionConfig: managerProductConfig,
        },
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
    canReceiveCommission: boolean,
    config: Package | null,
    options?: {
      fromProductGroup?: boolean;
      productReconsumptionConfig?: {
        reconsumptionThreshold: number;
        reconsumptionRequired: number;
      } | null;
    },
  ): Promise<Commission | null> {
    const rawCommissionAmount = groupCommissionAmount * rate;
    const commissionAmount = this.roundCommission(rawCommissionAmount);

    if (commissionAmount <= 0) {
      this.logger.debug(
        `Management commission amount is 0 (base or rate), skipping create for manager ${manager.id} F${level}`,
      );
      return null;
    }

    const orderValue = this.getOrderValueForCommission(order);
    const baseNote = options?.fromProductGroup
      ? 'From product group'
      : undefined;
    const blockedNote = canReceiveCommission
      ? undefined
      : 'Reconsumption required - keep pending, do not approve';
    const notes =
      [baseNote, blockedNote].filter(Boolean).join('; ') || undefined;

    const commission = this.commissionRepository.create({
      userId: manager.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.MANAGEMENT,
      status: canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
      amount: commissionAmount,
      orderAmount: orderValue,
      level: level,
      notes,
    });

    await this.commissionRepository.save(commission);

    if (canReceiveCommission) {
      if (options?.fromProductGroup && options?.productReconsumptionConfig) {
        await this.updateUserCommissionAndCheckThresholdWithProductConfig(
          manager,
          commissionAmount,
          options.productReconsumptionConfig,
        );
      } else if (config) {
        await this.updateUserCommissionAndCheckThreshold(
          manager,
          commissionAmount,
          config,
        );
      }
    }

    return commission;
  }

  /**
   * Cộng dồn hoa hồng và kiểm tra threshold hiệu lực (theo totalPurchaseAmount: mỗi lần mua >= giá gói thì threshold cộng thêm).
   */
  private async updateUserCommissionAndCheckThreshold(
    user: User,
    amount: number,
    config: Package,
  ) {
    await this.userRepository.increment(
      { id: user.id },
      'totalCommissionReceived',
      amount,
    );

    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });
    if (updatedUser) {
      const newTotalCommission = Number(updatedUser.totalCommissionReceived);
      const effectiveThreshold = this.packagesService.getEffectiveThreshold(
        Number(updatedUser.totalPurchaseAmount),
        config,
      );
      // Note: không tự set `packageType = NONE` nữa. Việc "đạt max hoa hồng"
      // sẽ chỉ ảnh hưởng luồng tái tiêu dùng (commission có thể vẫn Pending),
      // còn packageType của user giữ nguyên để logic khác nhất quán.
      void effectiveThreshold;
    }
  }

  /**
   * Kiểm tra điều kiện tái tiêu dùng. So sánh với threshold hiệu lực (tính theo totalPurchaseAmount).
   */
  private async checkReconsumption(
    user: User,
    config: Package,
  ): Promise<boolean> {
    if (user.packageType === 'NONE') {
      return true;
    }

    const effectiveThreshold = this.packagesService.getEffectiveThreshold(
      Number(user.totalPurchaseAmount),
      config,
    );
    if (Number(user.totalCommissionReceived) < effectiveThreshold) {
      return true;
    }
    return false;
  }

  /** Ngưỡng hiệu lực theo config sản phẩm (reconsumptionThreshold / reconsumptionRequired). Dùng khi useProductCommission = true. */
  private getEffectiveThresholdFromProductConfig(
    totalPurchaseAmount: number,
    config: { reconsumptionThreshold: number; reconsumptionRequired: number },
  ): number {
    const threshold = Number(config.reconsumptionThreshold) || 0;
    const required = Number(config.reconsumptionRequired) || 1;
    const total = Number(totalPurchaseAmount) || 0;
    return total * (threshold / required);
  }

  /**
   * Kiểm tra tái tiêu dùng theo config SẢN PHẨM (không dùng Package). Dùng trong luồng hoa hồng sản phẩm.
   * Nếu config null hoặc không có ngưỡng → cho nhận (true).
   */
  private async checkReconsumptionWithProductConfig(
    user: User,
    productConfig: {
      reconsumptionThreshold: number;
      reconsumptionRequired: number;
    } | null,
  ): Promise<boolean> {
    if (user.packageType === 'NONE') return true;
    if (
      !productConfig ||
      (Number(productConfig.reconsumptionThreshold) <= 0 &&
        Number(productConfig.reconsumptionRequired) <= 0)
    ) {
      return true;
    }
    const effectiveThreshold = this.getEffectiveThresholdFromProductConfig(
      Number(user.totalPurchaseAmount),
      productConfig,
    );
    if (Number(user.totalCommissionReceived) < effectiveThreshold) return true;
    return false;
  }

  /**
   * Cộng dồn hoa hồng và kiểm tra threshold theo config SẢN PHẨM (không dùng Package). Dùng trong luồng hoa hồng sản phẩm.
   */
  private async updateUserCommissionAndCheckThresholdWithProductConfig(
    user: User,
    amount: number,
    productConfig: {
      reconsumptionThreshold: number;
      reconsumptionRequired: number;
    } | null,
  ): Promise<void> {
    await this.userRepository.increment(
      { id: user.id },
      'totalCommissionReceived',
      amount,
    );
    if (
      !productConfig ||
      (Number(productConfig.reconsumptionThreshold) <= 0 &&
        Number(productConfig.reconsumptionRequired) <= 0)
    ) {
      return;
    }
    const updatedUser = await this.userRepository.findOne({
      where: { id: user.id },
    });
    if (updatedUser) {
      const newTotalCommission = Number(updatedUser.totalCommissionReceived);
      const effectiveThreshold = this.getEffectiveThresholdFromProductConfig(
        Number(updatedUser.totalPurchaseAmount),
        productConfig,
      );
      // Không set `packageType = NONE` để giữ nguyên trạng thái user.
      void effectiveThreshold;
    }
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
      const parent = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
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
    // Hoa hồng nhóm chỉ cần ÍT NHẤT MỘT nhánh có doanh số.
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'leftBranchTotal', 'rightBranchTotal'],
    });
    if (!user) return false;

    const leftTotal = Number(user.leftBranchTotal ?? 0);
    const rightTotal = Number(user.rightBranchTotal ?? 0);
    return leftTotal > 0 || rightTotal > 0;
  }

  private hasBothBranchesFromUser(user: User): boolean {
    const leftTotal = Number(user.leftBranchTotal ?? 0);
    const rightTotal = Number(user.rightBranchTotal ?? 0);
    return leftTotal > 0 || rightTotal > 0;
  }

  private async getBuyerSide(
    buyer: User,
    ancestor: User,
  ): Promise<'left' | 'right'> {
    // Traverse up from buyer until we find the child of ancestor
    let current = buyer;
    while (current.parentId && current.parentId !== ancestor.id) {
      const parent = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
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

  private getWeakSideFromUser(user: User): 'left' | 'right' | null {
    const left = Number(user.leftBranchTotal ?? 0);
    const right = Number(user.rightBranchTotal ?? 0);
    if (left < right) return 'left';
    if (right < left) return 'right';
    return null;
  }

  // --- Missing Read/Admin Methods ---

  /**
   * Lấy stats commission cho nhiều user trong MỘT query (GROUP BY userId).
   * Dùng cho admin getAllStats để tránh N+1.
   */
  async getStatsForUserIds(userIds: string[]): Promise<
    Map<
      string,
      {
        totalCommission: number;
        pendingCommission: number;
        commissions: { direct: number; group: number; management: number };
      }
    >
  > {
    const map = new Map<
      string,
      {
        totalCommission: number;
        pendingCommission: number;
        commissions: { direct: number; group: number; management: number };
      }
    >();
    if (userIds.length === 0) return map;

    const num = (v: string | null | undefined): number =>
      v === null || v === undefined ? 0 : parseFloat(String(v)) || 0;

    const qb = this.commissionRepository.createQueryBuilder('c');
    const rows = await qb
      .select('c.userId', 'userId')
      .addSelect(
        'COALESCE(SUM(CASE WHEN c.status = :paid THEN c.amount ELSE 0 END), 0)',
        'totalCommission',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN c.status = :pending THEN c.amount ELSE 0 END), 0)',
        'pendingCommission',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN c.type = 'direct' AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
        'direct',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN c.type = 'group' AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
        'group',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN c.type = 'management' AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
        'management',
      )
      .where('c.userId IN (:...userIds)', { userIds })
      .groupBy('c.userId')
      .setParameters({
        paid: CommissionStatus.PAID,
        pending: CommissionStatus.PENDING,
      })
      .getRawMany<{
        userId: string;
        totalCommission: string;
        pendingCommission: string;
        direct: string;
        group: string;
        management: string;
      }>();

    for (const row of rows) {
      map.set(row.userId, {
        totalCommission: this.roundCommission(num(row.totalCommission)),
        pendingCommission: this.roundCommission(num(row.pendingCommission)),
        commissions: {
          direct: this.roundCommission(num(row.direct)),
          group: this.roundCommission(num(row.group)),
          management: this.roundCommission(num(row.management)),
        },
      });
    }
    return map;
  }

  async getStats(userId: string) {
    const qb = this.commissionRepository.createQueryBuilder('c');
    const raw = await qb
      .select(
        'COALESCE(SUM(CASE WHEN c.status = :paid THEN c.amount ELSE 0 END), 0)',
        'totalCommission',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN c.status = :pending THEN c.amount ELSE 0 END), 0)',
        'pendingCommission',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN c.type = 'direct' AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
        'direct',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN c.type = 'group' AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
        'group',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN c.type = 'management' AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
        'management',
      )
      .where('c.userId = :userId', { userId })
      .setParameters({
        paid: CommissionStatus.PAID,
        pending: CommissionStatus.PENDING,
      })
      .getRawOne<{
        totalCommission: string;
        pendingCommission: string;
        direct: string;
        group: string;
        management: string;
      }>();

    const num = (v: string | null | undefined): number =>
      v === null || v === undefined ? 0 : parseFloat(String(v)) || 0;

    return {
      totalCommission: this.roundCommission(num(raw?.totalCommission)),
      pendingCommission: this.roundCommission(num(raw?.pendingCommission)),
      commissions: {
        direct: this.roundCommission(num(raw?.direct)),
        group: this.roundCommission(num(raw?.group)),
        management: this.roundCommission(num(raw?.management)),
      },
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

    return commissions.map((c) => ({
      ...c,
      amount: this.roundCommission(Number(c.amount)),
    }));
  }

  async getPendingCommissionSum(userId: string): Promise<number> {
    const raw = await this.commissionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount), 0)', 'sum')
      .where('c.userId = :userId', { userId })
      .andWhere('c.status = :status', { status: CommissionStatus.PENDING })
      .getRawOne<{ sum: string }>();
    return this.roundCommission(Number(raw?.sum ?? 0));
  }

  async getCurrentMonthPaidCommissionSum(userId: string): Promise<number> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const nextMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      0,
    );

    const raw = await this.commissionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount), 0)', 'sum')
      .where('c.userId = :userId', { userId })
      .andWhere('c.status = :status', { status: CommissionStatus.PAID })
      .andWhere('c.createdAt >= :monthStart', { monthStart })
      .andWhere('c.createdAt < :nextMonthStart', { nextMonthStart })
      .getRawOne<{ sum: string }>();

    return this.roundCommission(Number(raw?.sum ?? 0));
  }

  async getCommissionsLimited(
    userId: string,
    query: { type?: CommissionType; status?: CommissionStatus },
    limit: number,
  ) {
    const take = Math.min(Math.max(1, limit), 100);
    const qb = this.commissionRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.fromUser', 'fromUser')
      .where('c.userId = :userId', { userId })
      .orderBy('c.createdAt', 'DESC')
      .take(take);

    if (query.type) {
      qb.andWhere('c.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    const commissions = await qb.getMany();
    return commissions.map((c) => ({
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

    return commissions.map((c) => ({
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

  /** Admin hủy: chỉ pending / blocked. Ghi chú nối thêm [Admin cancelled]. */
  async cancelCommission(
    commissionId: string,
    reason?: string,
  ): Promise<Commission> {
    const commission = await this.commissionRepository.findOne({
      where: { id: commissionId },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    if (
      commission.status !== CommissionStatus.PENDING &&
      commission.status !== CommissionStatus.BLOCKED
    ) {
      throw new BadRequestException(
        `Only pending or blocked commissions can be cancelled (current: ${commission.status})`,
      );
    }

    commission.status = CommissionStatus.CANCELLED;
    const noteSuffix = reason?.trim()
      ? `[Admin cancelled] ${reason.trim()}`
      : '[Admin cancelled]';
    commission.notes = commission.notes
      ? `${commission.notes}; ${noteSuffix}`
      : noteSuffix;

    return this.commissionRepository.save(commission);
  }

  async cancelCommissions(commissionIds: string[], reason?: string): Promise<{
    cancelled: number;
    failed: number;
    results: Commission[];
    errors: string[];
  }> {
    const results: Commission[] = [];
    const errors: string[] = [];
    for (const id of commissionIds) {
      try {
        const result = await this.cancelCommission(id, reason);
        results.push(result);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${id}: ${msg}`);
        this.logger.warn(`Cancel commission ${id} failed: ${msg}`);
      }
    }
    return {
      cancelled: results.length,
      failed: errors.length,
      results,
      errors,
    };
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
          notes = 'Reconsumption required - keep pending, do not approve';
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
          await this.updateUserCommissionAndCheckThreshold(
            user,
            amount,
            config,
          );
        } else {
          await this.userRepository.increment(
            { id: userId },
            'totalCommissionReceived',
            amount,
          );
        }
      } else {
        await this.userRepository.increment(
          { id: userId },
          'totalCommissionReceived',
          amount,
        );
      }
    }

    return commission;
  }
}
