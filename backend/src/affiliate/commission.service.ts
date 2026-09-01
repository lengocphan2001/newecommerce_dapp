import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, MoreThanOrEqual, Between } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import {
  Commission,
  CommissionType,
  CommissionStatus,
} from './entities/commission.entity';
import { BranchVolumeLog } from './entities/branch-volume-log.entity';
import { UserMonthlyStats } from './entities/user-monthly-stats.entity';
import { PackagesService } from '../packages/packages.service';
import { Package } from '../packages/entities/package.entity';
import { Product } from '../product/entities/product.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';
import {
  buildChildrenMap,
  computeSubtreeAggregates,
} from '../common/utils/referral-tree';
import {
  DAILY_RANK_MIN_PURCHASE,
  GLOBAL_SHARE_RATES,
  GROUP_REWARD_TIERS,
  MONTHLY_RANK_ORDER,
  MONTHLY_RANK_PROMOTION_LOOP_LIMIT,
  MONTHLY_RANK_PROMOTION_ORDER,
  MONTHLY_RANK_RULES,
  rankLabel,
} from '../common/constants/ranks';

/** Số cấp hoa hồng quản lý: chỉ trả cho 3 parent gần nhất (F1, F2, F3) kể từ người nhận group trở lên. */
const MANAGEMENT_MAX_LEVELS = 3;

/** Kết quả tính toán doanh số/cấp bậc của cả hệ thống trong một tháng. */
export interface MonthlySnapshot {
  month: string;
  startDate: Date;
  endDate: Date;
  prevMonthStr: string;
  users: User[];
  f1Map: Map<string, string[]>;
  /** Doanh số của cả nhánh, tính cả chính người đó. */
  subtreeSalesMap: Map<string, number>;
  /** Số người trong nhánh, tính cả chính người đó. */
  subtreeCountMap: Map<string, number>;
  personalSalesMap: Map<string, number>;
  groupSalesMap: Map<string, number>;
  ranksMap: Map<string, string>;
  groupRewardRateMap: Map<string, number>;
  groupRewardAmountMap: Map<string, number>;
  globalShareMap: Map<string, number>;
  usersByRank: Map<string, string[]>;
  prevRatesMap: Map<string, number>;
  totalNationalSales: number;
}

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);
  private static readonly DEFAULT_INDIRECT_RATE_PERCENT = 5;
  private configCache: Map<string, Package> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate: number = 0;
  private monthlySnapshotCache: Map<
    string,
    { data: MonthlySnapshot; expiresAt: number }
  > = new Map();
  private static readonly MONTHLY_SNAPSHOT_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(SystemConfig)
    private systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(BranchVolumeLog)
    private branchVolumeLogRepository: Repository<BranchVolumeLog>,
    @InjectRepository(UserMonthlyStats)
    private userMonthlyStatsRepository: Repository<UserMonthlyStats>,
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
  /**
   * Order value used for commission (sum of product price * quantity).
   */
  private getOrderValueForCommission(order: Order): number {
    const items = Array.isArray(order.items) ? order.items : [];
    const baseValue = items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + price * quantity;
    }, 0);
    return baseValue;
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

      if (!order.userId) {
        this.logger.log(
          `Order ${orderId} has no userId (guest order). Skipping commission calculation.`,
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

      // BƯỚC 1c: Hoa hồng gián tiếp F2 (mặc định 5%, admin có thể cấu hình)
      this.logger.log(
        `Step 1c: Calculating indirect F2 commission for order ${orderId}`,
      );
      await this.calculateIndirectCommission(order, buyer, productMap);

      // BƯỚC 2: Update volume cho TẤT CẢ ancestors (giữ nguyên để phục vụ các logic cây khác)
      this.logger.log(`Step 2: Updating branch volumes for order ${orderId}`);
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

  private async getIndirectCommissionRatePercent(): Promise<number> {
    const row = await this.systemConfigRepository.findOne({
      where: { key: 'indirectCommissionRateF2' },
    });
    const parsed = Number(row?.value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return CommissionService.DEFAULT_INDIRECT_RATE_PERCENT;
    }
    return parsed;
  }

  /**
   * Hoa hồng gián tiếp:
   * Buyer -> F1 (direct referrer) -> F2.
   * Khi buyer mua hàng, F2 nhận % trên giá trị đơn (admin config, mặc định 5%).
   */
  private async calculateIndirectCommission(
    order: Order,
    buyer: User,
    preloadedProductMap?: Map<string, Product>,
  ): Promise<void> {
    const freshBuyer = await this.userRepository.findOne({
      where: { id: buyer.id },
      select: ['id', 'referralUserId'],
    });
    if (!freshBuyer?.referralUserId) return;

    const f1 = await this.userRepository.findOne({
      where: { id: freshBuyer.referralUserId },
      select: ['id', 'referralUserId'],
    });
    if (!f1?.referralUserId) return;

    const f2 = await this.userRepository.findOne({ where: { id: f1.referralUserId } });
    if (!f2) return;

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return;

    const productMap = preloadedProductMap ?? (await this.getOrderProductsMap(order));
    const globalRatePercent = await this.getIndirectCommissionRatePercent();

    let totalIndirectCommissionAmount = 0;
    let totalOrderAmount = 0;
    let hasCustomRate = false;

    for (const item of items) {
      if (
        !item?.productId ||
        typeof item.quantity !== 'number' ||
        typeof item.price !== 'number'
      )
        continue;

      const product = productMap.get(item.productId);
      if (!product) continue;

      const basePct =
        typeof product.commissionBasePercent === 'number' &&
        Number.isFinite(product.commissionBasePercent)
          ? product.commissionBasePercent
          : 95;
      const itemAmount = Number(item.price) * item.quantity * (basePct / 100);
      totalOrderAmount += itemAmount;

      let ratePercent = globalRatePercent;
      if (product.useProductCommission === true) {
        ratePercent = product.indirectCommissionRateF2 ?? 0;
        hasCustomRate = true;
      }

      if (ratePercent > 0) {
        totalIndirectCommissionAmount += itemAmount * (ratePercent / 100);
      }
    }

    const commissionAmount = this.roundCommission(totalIndirectCommissionAmount);
    if (commissionAmount <= 0) return;

    const commission = this.commissionRepository.create({
      userId: f2.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.INDIRECT,
      status: CommissionStatus.PENDING,
      amount: commissionAmount,
      orderAmount: totalOrderAmount,
      notes: hasCustomRate
        ? `Indirect F2 commission (custom product base & rates)`
        : `Indirect F2 commission (global rate ${globalRatePercent}%)`,
    });
    await this.commissionRepository.save(commission);

    await this.userRepository.increment(
      { id: f2.id },
      'totalCommissionReceived',
      commissionAmount,
    );
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
      const basePct =
        typeof product.commissionBasePercent === 'number' &&
        Number.isFinite(product.commissionBasePercent)
          ? product.commissionBasePercent
          : 95;
      packageOrderValue += Number(item.price) * item.quantity * (basePct / 100);
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
    let byPkg =
      product.commissionConfigByPackage &&
      product.commissionConfigByPackage[code];
    if (!byPkg && product.commissionConfigByPackage) {
      if (code !== 'TV' && code !== 'CTV') {
        byPkg = product.commissionConfigByPackage['DT'] || product.commissionConfigByPackage['NPP'];
      }
    }
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
    return Number(product.commissionPercentNPP) || 0;
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
    return Number(product.commissionPercentGroupNPP) || 0;
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
    return Number(product.commissionPercentManagementNPP) || 0;
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

    const items = Array.isArray(order.items) ? order.items : [];
    const productMap = preloadedProductMap ?? (await this.getOrderProductsMap(order));

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
      const basePct =
        typeof product.commissionBasePercent === 'number' &&
        Number.isFinite(product.commissionBasePercent)
          ? product.commissionBasePercent
          : 95;
      const itemAmount = Number(item.price) * item.quantity * (basePct / 100);
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

      // Đã loại bỏ product group/management theo yêu cầu tối giản:
      // chỉ giữ lại hoa hồng direct.
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

      // Lưu lại lịch sử cập nhật doanh số nhánh
      try {
        await this.branchVolumeLogRepository.save({
          userId: ancestor.id,
          orderId: order.id,
          amount: orderValue,
          side: buyerSide,
        });
        this.logger.log(
          `Logged branch volume change for user ${ancestor.id}: +${orderValue} on ${buyerSide}`,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to log branch volume change for user ${ancestor.id}: ${err.message}`,
        );
      }
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
      const basePct =
        typeof product.commissionBasePercent === 'number' &&
        Number.isFinite(product.commissionBasePercent)
          ? product.commissionBasePercent
          : 95;
      packageOrderValue += Number(item.price) * item.quantity * (basePct / 100);
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
        updatedUser.customMaxCommission,
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
      user.customMaxCommission,
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
    customMaxCommission?: number | null,
  ): number {
    if (customMaxCommission !== undefined && customMaxCommission !== null) {
      const val = Number(customMaxCommission);
      if (val === -1) {
        return 999999999;
      }
      if (val > 0) {
        return val;
      }
    }
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
      user.customMaxCommission,
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
        updatedUser.customMaxCommission,
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
        "COALESCE(SUM(CASE WHEN c.type IN ('direct','indirect','product') AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
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
        "COALESCE(SUM(CASE WHEN c.type IN ('direct','indirect','product') AND c.status = :paid THEN c.amount ELSE 0 END), 0)",
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

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'manualRank'],
    });

    const latestStats = await this.userMonthlyStatsRepository.findOne({
      where: { userId },
      order: { month: 'DESC' },
    });

    return {
      totalCommission: this.roundCommission(num(raw?.totalCommission)),
      pendingCommission: this.roundCommission(num(raw?.pendingCommission)),
      commissions: {
        direct: this.roundCommission(num(raw?.direct)),
        group: this.roundCommission(num(raw?.group)),
        management: this.roundCommission(num(raw?.management)),
      },
      monthlyStats: latestStats ? {
        month: latestStats.month,
        calculatedRank: user && user.manualRank && user.manualRank !== 'NONE' ? user.manualRank : latestStats.calculatedRank,
        groupSales: Number(latestStats.groupSales) || 0,
        personalSales: Number(latestStats.personalSales) || 0,
        groupRewardAmount: Number(latestStats.groupRewardAmount) || 0,
        globalShareAmount: Number(latestStats.globalShareAmount) || 0,
        isProcessed: latestStats.isProcessed,
      } : (user && user.manualRank && user.manualRank !== 'NONE' ? {
        month: 'current',
        calculatedRank: user.manualRank,
        groupSales: 0,
        personalSales: 0,
        groupRewardAmount: 0,
        globalShareAmount: 0,
        isProcessed: false,
      } : null),
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

    if (commission.status !== CommissionStatus.PENDING && commission.status !== CommissionStatus.BLOCKED) {
      throw new Error('Commission status is not PENDING or BLOCKED');
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

  async compensateMissedDirectCommissions(fromDateStr?: string): Promise<{ success: boolean; compensatedCount: number; totalCompensatedAmount: number }> {
    this.logger.log(`Starting compensation of missed direct commissions from date: ${fromDateStr || 'last 30 days'}`);
    const fromDate = fromDateStr ? new Date(fromDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orders = await this.orderRepository.find({
      where: {
        status: OrderStatus.CONFIRMED,
        createdAt: MoreThanOrEqual(fromDate),
      },
    });

    let compensatedCount = 0;
    let totalCompensatedAmount = 0;

    for (const order of orders) {
      if (!order.userId) continue;

      const buyer = await this.userRepository.findOne({
        where: { id: order.userId },
        select: ['id', 'referralUserId', 'packageType'],
      });
      if (!buyer || !buyer.referralUserId) continue;

      // Check if a direct or product commission already exists for this order
      const existingDirect = await this.commissionRepository.findOne({
        where: {
          orderId: order.id,
          type: In([CommissionType.DIRECT, CommissionType.PRODUCT]),
        },
      });

      if (existingDirect) {
        continue;
      }

      // Check if this order has items
      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length === 0) continue;

      // Load products map
      const productMap = await this.getOrderProductsMap(order);

      // Determine if we need to call calculateDirectCommission or calculateProductCommission
      let hasPackageDirect = false;
      let hasProductDirect = false;

      for (const item of items) {
        if (!item?.productId) continue;
        const product = productMap.get(item.productId);
        if (!product) continue;
        if (product.useProductCommission === true) {
          hasProductDirect = true;
        } else {
          hasPackageDirect = true;
        }
      }

      const prevCount = await this.commissionRepository.count({
        where: {
          orderId: order.id,
          type: In([CommissionType.DIRECT, CommissionType.PRODUCT]),
        },
      });

      if (hasPackageDirect) {
        await this.calculateDirectCommission(order, buyer, productMap);
      }
      if (hasProductDirect) {
        await this.calculateProductCommission(order, buyer, productMap);
      }

      const newCommissions = await this.commissionRepository.find({
        where: {
          orderId: order.id,
          type: In([CommissionType.DIRECT, CommissionType.PRODUCT]),
        },
      });

      if (newCommissions.length > prevCount) {
        compensatedCount++;
        for (const comm of newCommissions) {
          totalCompensatedAmount += Number(comm.amount) || 0;
        }
      }
    }

    this.logger.log(`Compensated ${compensatedCount} orders. Total compensated amount: ${totalCompensatedAmount} USD`);
    return {
      success: true,
      compensatedCount,
      totalCompensatedAmount,
    };
  }

  async compensateSingleOrderCommission(orderId: string): Promise<{ success: boolean; compensated: boolean; amount: number; message: string }> {
    this.logger.log(`Compensating missed direct commissions for order: ${orderId}`);
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderId}`);
    }

    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(`Đơn hàng phải ở trạng thái CONFIRMED hoặc DELIVERED.`);
    }

    if (!order.userId) {
      throw new BadRequestException('Đơn hàng không có userId (guest order).');
    }

    const buyer = await this.userRepository.findOne({
      where: { id: order.userId },
      select: ['id', 'referralUserId', 'packageType'],
    });

    if (!buyer || !buyer.referralUserId) {
      return {
        success: true,
        compensated: false,
        amount: 0,
        message: 'Đơn hàng không có người giới thiệu (F1).',
      };
    }

    // Check if a direct or product commission already exists for this order
    const existingDirect = await this.commissionRepository.findOne({
      where: {
        orderId: order.id,
        type: In([CommissionType.DIRECT, CommissionType.PRODUCT]),
      },
    });

    if (existingDirect) {
      return {
        success: true,
        compensated: false,
        amount: 0,
        message: 'Đơn hàng này đã được nhận hoa hồng trực tiếp trước đó.',
      };
    }

    // Check items
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) {
      throw new BadRequestException('Đơn hàng không có sản phẩm.');
    }

    // Load products map
    const productMap = await this.getOrderProductsMap(order);

    let hasPackageDirect = false;
    let hasProductDirect = false;

    for (const item of items) {
      if (!item?.productId) continue;
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (product.useProductCommission === true) {
        hasProductDirect = true;
      } else {
        hasPackageDirect = true;
      }
    }

    const prevCount = await this.commissionRepository.count({
      where: {
        orderId: order.id,
        type: In([CommissionType.DIRECT, CommissionType.PRODUCT]),
      },
    });

    if (hasPackageDirect) {
      await this.calculateDirectCommission(order, buyer, productMap);
    }
    if (hasProductDirect) {
      await this.calculateProductCommission(order, buyer, productMap);
    }

    const newCommissions = await this.commissionRepository.find({
      where: {
        orderId: order.id,
        type: In([CommissionType.DIRECT, CommissionType.PRODUCT]),
      },
    });

    if (newCommissions.length > prevCount) {
      let compensatedAmount = 0;
      for (const comm of newCommissions) {
        compensatedAmount += Number(comm.amount) || 0;
      }
      return {
        success: true,
        compensated: true,
        amount: compensatedAmount,
        message: `Bù hoa hồng thành công! Đã chuyển $${compensatedAmount.toLocaleString()} USD hoa hồng trực tiếp cho người giới thiệu.`,
      };
    }

    return {
      success: true,
      compensated: false,
      amount: 0,
      message: 'Không tìm thấy cấu hình hoa hồng hợp lệ hoặc người giới thiệu chưa đủ điều kiện nhận.',
    };
  }

  /**
   * Tính toàn bộ doanh số cá nhân, doanh số nhóm, cấp bậc và các khoản thưởng
   * của một tháng mà không ghi gì xuống DB. Dùng chung cho việc chốt số và cho
   * màn hình xem chi tiết từng thành viên, để hai nơi không bao giờ lệch nhau.
   */
  private async buildMonthlySnapshot(month: string): Promise<MonthlySnapshot> {
    // 1. Parse month range
    const [yearStr, monthStr] = month.split('-');
    const y = parseInt(yearStr);
    const m = parseInt(monthStr);
    const startDate = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    // 2. Fetch all users
    const users = await this.userRepository.find({
      select: ['id', 'username', 'email', 'referralUserId', 'totalPurchaseAmount', 'manualRank'],
    });

    // 3. Fetch all orders in the month
    const orders = await this.orderRepository.find({
      where: {
        status: In([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
        createdAt: Between(startDate, endDate),
      },
    });

    // Calc total national sales
    let totalNationalSales = 0;
    const userPersonalSalesMap = new Map<string, number>();

    for (const order of orders) {
      const amt = Number(order.totalAmount) || 0;
      totalNationalSales += amt;
      if (order.userId) {
        userPersonalSalesMap.set(
          order.userId,
          (userPersonalSalesMap.get(order.userId) || 0) + amt,
        );
      }
    }

    // 4. Build referral tree children map to find F1s
    const f1Map = buildChildrenMap(
      users,
      (u) => u.id,
      (u) => u.referralUserId,
    );

    // Tổng doanh số từng nhánh trong một lượt duyệt thay vì duyệt lại cây cho
    // mỗi user.
    const { subtreeValue: subtreeSalesMap, subtreeCount: subtreeCountMap, cyclicNodeIds } =
      computeSubtreeAggregates(
        users.map((u) => u.id),
        f1Map,
        (id) => userPersonalSalesMap.get(id) || 0,
      );

    if (cyclicNodeIds.length > 0) {
      this.logger.warn(
        `Cây giới thiệu có ${cyclicNodeIds.length} node nằm trong vòng lặp khi tính tháng ${month}: ${cyclicNodeIds
          .slice(0, 10)
          .join(', ')}`,
      );
    }

    // Doanh số nhóm = tổng các nhánh F1, không tính doanh số cá nhân.
    const userGroupSalesMap = new Map<string, number>();
    for (const u of users) {
      let gSales = 0;
      for (const f1Id of f1Map.get(u.id) || []) {
        gSales += subtreeSalesMap.get(f1Id) || 0;
      }
      userGroupSalesMap.set(u.id, gSales);
    }

    // 5. Determine Ranks bottom-up
    const ranksMap = new Map<string, string>();

    // Step 5.1: Is user Đại lý? (Lifetime purchase >= 15M VND / $600)
    for (const u of users) {
      if (u.manualRank && u.manualRank !== 'NONE') {
        ranksMap.set(u.id, u.manualRank);
      } else {
        const isDaiLy =
          Number(u.totalPurchaseAmount) >= DAILY_RANK_MIN_PURCHASE;
        ranksMap.set(u.id, isDaiLy ? 'DAILY' : 'C0');
      }
    }

    // Ranks values hierarchy helper
    const isAtLeastRank = (userId: string, targetRank: string): boolean => {
      const currentRank = ranksMap.get(userId) || 'C0';
      return (
        MONTHLY_RANK_ORDER.indexOf(currentRank) >=
        MONTHLY_RANK_ORDER.indexOf(targetRank)
      );
    };

    // Xét thăng cấp C1..C9, lặp lại tới khi không ai đổi cấp nữa.
    // Một lượt duy nhất là không đủ: cấp dưới có thể vượt lên C1 ngay trong
    // lượt đó, sau khi tuyến trên đã được xét, nên kết quả phụ thuộc thứ tự
    // dòng trả về của DB. Cấp bậc chỉ tăng nên vòng lặp luôn dừng.
    for (let pass = 0; ; pass++) {
      let changed = false;

      for (const r of MONTHLY_RANK_PROMOTION_ORDER) {
        const requirements = MONTHLY_RANK_RULES[r];
        for (const u of users) {
          const currentRank = ranksMap.get(u.id) || 'C0';
          if (
            MONTHLY_RANK_ORDER.indexOf(currentRank) >=
            MONTHLY_RANK_ORDER.indexOf(r)
          ) {
            // Đã bằng hoặc cao hơn r, xét tiếp chỉ có thể hạ cấp.
            continue;
          }

          const f1Ids = f1Map.get(u.id) || [];
          const isPromoted = requirements.every(
            (req) =>
              f1Ids.filter((id) => isAtLeastRank(id, req.rank)).length >=
              req.count,
          );

          if (isPromoted) {
            ranksMap.set(u.id, r);
            changed = true;
          }
        }
      }

      if (!changed) break;

      if (pass >= MONTHLY_RANK_PROMOTION_LOOP_LIMIT) {
        this.logger.warn(
          `Xếp hạng tháng ${month} chưa hội tụ sau ${MONTHLY_RANK_PROMOTION_LOOP_LIMIT} lượt, dừng sớm`,
        );
        break;
      }
    }

    // Get previous month string
    const prevMonthDate = new Date(y, m - 2, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    // Get previous month rates map to apply "Không tụt hạng"
    const prevStats = await this.userMonthlyStatsRepository.find({
      where: { month: prevMonthStr },
    });
    const prevRatesMap = new Map(prevStats.map((s) => [s.userId, Number(s.groupRewardRate) || 0]));

    // 6. Calculate Group Rewards (Tầng 3)
    const userGroupRewardRateMap = new Map<string, number>();
    const userGroupRewardAmountMap = new Map<string, number>();

    for (const u of users) {
      const gSales = userGroupSalesMap.get(u.id) || 0;
      let currentMonthRate = 0;

      const tier = GROUP_REWARD_TIERS.find((t) => gSales >= t.min);
      currentMonthRate = tier ? tier.rate : 0;

      // Apply "Không tụt hạng"
      const prevRate = prevRatesMap.get(u.id) || 0;
      const appliedRate = Math.max(currentMonthRate, prevRate);

      userGroupRewardRateMap.set(u.id, appliedRate);
      userGroupRewardAmountMap.set(u.id, gSales * appliedRate);
    }

    // 7. Calculate Global Share Rewards (Tầng 4)
    // C1: 4%, C2: 2%, C3: 1%, C4-C9: 0.5% each
    const globalRates = GLOBAL_SHARE_RATES;

    const usersByRank = new Map<string, string[]>();
    for (const u of users) {
      const r = ranksMap.get(u.id) || 'C0';
      if (r !== 'C0' && r !== 'DAILY') {
        const list = usersByRank.get(r) || [];
        list.push(u.id);
        usersByRank.set(r, list);
      }
    }

    const userGlobalShareMap = new Map<string, number>();

    for (const r of Object.keys(globalRates)) {
      const rate = globalRates[r];
      const qualifiedUserIds = usersByRank.get(r) || [];
      const poolAmount = totalNationalSales * rate;

      if (qualifiedUserIds.length > 0) {
        const shareAmount = poolAmount / qualifiedUserIds.length;
        for (const userId of qualifiedUserIds) {
          userGlobalShareMap.set(userId, shareAmount);
        }
      }
    }

    return {
      month,
      startDate,
      endDate,
      prevMonthStr,
      users,
      f1Map,
      subtreeSalesMap,
      subtreeCountMap,
      personalSalesMap: userPersonalSalesMap,
      groupSalesMap: userGroupSalesMap,
      ranksMap,
      groupRewardRateMap: userGroupRewardRateMap,
      groupRewardAmountMap: userGroupRewardAmountMap,
      globalShareMap: userGlobalShareMap,
      usersByRank,
      prevRatesMap,
      totalNationalSales,
    };
  }

  /**
   * Chốt doanh số tháng: ghi UserMonthlyStats, và khi performPayout = true thì
   * tạo commission Tầng 3 / Tầng 4 và cộng vào ví người dùng.
   */
  async calculateMonthlyRewards(
    month: string,
    performPayout: boolean = false,
  ): Promise<{
    success: boolean;
    totalNationalSales: number;
    statsCount: number;
    payoutCount: number;
    totalPayoutAmount: number;
    usersStats: any[];
  }> {
    const snapshot = await this.buildMonthlySnapshot(month);
    const {
      users,
      totalNationalSales,
      personalSalesMap: userPersonalSalesMap,
      groupSalesMap: userGroupSalesMap,
      ranksMap,
      groupRewardRateMap: userGroupRewardRateMap,
      groupRewardAmountMap: userGroupRewardAmountMap,
      globalShareMap: userGlobalShareMap,
    } = snapshot;

    // 8. Save or update UserMonthlyStats in DB and execute payouts if performPayout is true
    let statsCount = 0;
    let payoutCount = 0;
    let totalPayoutAmount = 0;
    const usersStatsResult: any[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const u of users) {
        const pSales = userPersonalSalesMap.get(u.id) || 0;
        const gSales = userGroupSalesMap.get(u.id) || 0;
        const r = ranksMap.get(u.id) || 'C0';
        const rate = userGroupRewardRateMap.get(u.id) || 0;
        const gReward = userGroupRewardAmountMap.get(u.id) || 0;
        const gShare = userGlobalShareMap.get(u.id) || 0;

        if (pSales === 0 && gSales === 0 && r === 'C0' && gReward === 0 && gShare === 0) {
          continue;
        }

        let stats = await manager.findOne(UserMonthlyStats, {
          where: { userId: u.id, month },
        });

        if (!stats) {
          stats = manager.create(UserMonthlyStats, {
            userId: u.id,
            month,
          });
        }

        stats.personalSales = pSales;
        stats.groupSales = gSales;
        stats.calculatedRank = r;
        stats.groupRewardRate = rate;
        stats.groupRewardAmount = gReward;
        stats.globalShareAmount = gShare;

        if (performPayout && !stats.isProcessed) {
          stats.isProcessed = true;

          // 1. Payout Group Reward (Tầng 3)
          if (gReward > 0) {
            const commGroup = manager.create(Commission, {
              userId: u.id,
              amount: gReward,
              type: CommissionType.GROUP_MONTHLY,
              status: CommissionStatus.PENDING,
              notes: `Thưởng nhóm đại lý tháng ${month} (Doanh số nhóm: $${gSales.toLocaleString()}, Tỷ lệ: ${(rate * 100).toFixed(1)}%)`,
              orderAmount: gSales,
              orderId: null,
            });
            await manager.save(commGroup);
            await manager.increment(User, { id: u.id }, 'totalCommissionReceived', gReward);
            payoutCount++;
            totalPayoutAmount += gReward;
          }

          // 2. Payout Global Share Reward (Tầng 4)
          if (gShare > 0) {
            const commShare = manager.create(Commission, {
              userId: u.id,
              amount: gShare,
              type: CommissionType.GLOBAL_SHARE_MONTHLY,
              status: CommissionStatus.PENDING,
              notes: `Đồng chia toàn quốc cấp bậc ${r} tháng ${month} (Tổng DS toàn quốc: $${totalNationalSales.toLocaleString()})`,
              orderAmount: totalNationalSales,
              orderId: null,
            });
            await manager.save(commShare);
            await manager.increment(User, { id: u.id }, 'totalCommissionReceived', gShare);
            payoutCount++;
            totalPayoutAmount += gShare;
          }
        }

        await manager.save(stats);
        statsCount++;

        usersStatsResult.push({
          userId: u.id,
          username: u.username,
          email: u.email,
          personalSales: pSales,
          groupSales: gSales,
          calculatedRank: r,
          groupRewardRate: rate,
          groupRewardAmount: gReward,
          globalShareAmount: gShare,
          isProcessed: stats.isProcessed,
        });
      }
    });

    // Dữ liệu tháng vừa đổi (và tỷ lệ tháng sau phụ thuộc tháng này), bỏ cache.
    this.monthlySnapshotCache.clear();

    return {
      success: true,
      totalNationalSales,
      statsCount,
      payoutCount,
      totalPayoutAmount,
      usersStats: usersStatsResult,
    };
  }

  /** Snapshot có cache ngắn hạn, dùng cho các màn hình chỉ đọc. */
  private async getMonthlySnapshot(month: string): Promise<MonthlySnapshot> {
    const cached = this.monthlySnapshotCache.get(month);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const data = await this.buildMonthlySnapshot(month);
    this.monthlySnapshotCache.set(month, {
      data,
      expiresAt: Date.now() + CommissionService.MONTHLY_SNAPSHOT_TTL_MS,
    });
    return data;
  }

  /**
   * Đối chiếu danh sách F1 với điều kiện của một cấp bậc, trả về số lượng đạt
   * và danh sách F1 nào được tính. Trả null nếu cấp đó không có điều kiện F1
   * (C0, Đại lý).
   */
  private evaluateRankRequirements(
    targetRank: string,
    f1Ids: string[],
    ranksMap: Map<string, string>,
  ) {
    const rules = MONTHLY_RANK_RULES[targetRank];
    if (!rules) return null;

    const qualifiedF1Ids = new Set<string>();
    const requirements = rules.map((rule) => {
      const matchedF1Ids = f1Ids.filter(
        (id) =>
          MONTHLY_RANK_ORDER.indexOf(ranksMap.get(id) || 'C0') >=
          MONTHLY_RANK_ORDER.indexOf(rule.rank),
      );
      matchedF1Ids.forEach((id) => qualifiedF1Ids.add(id));
      return {
        requiredRank: rule.rank,
        requiredRankLabel: rankLabel(rule.rank),
        requiredCount: rule.count,
        actualCount: matchedF1Ids.length,
        satisfied: matchedF1Ids.length >= rule.count,
        matchedF1Ids,
      };
    });

    return {
      rank: targetRank,
      ruleText: rules
        .map((r) => `${r.count} F1 đạt ${rankLabel(r.rank)} trở lên`)
        .join(' và '),
      requirements,
      satisfied: requirements.every((r) => r.satisfied),
      qualifiedF1Ids: Array.from(qualifiedF1Ids),
    };
  }

  /**
   * Chi tiết doanh số / cấp bậc tháng của một thành viên: F1 nào thỏa điều kiện
   * cấp bậc, doanh số từng nhánh, cách ra tỷ lệ thưởng nhóm và tiền đồng chia.
   */
  async getMonthlyUserDetail(month: string, userId: string) {
    const snapshot = await this.getMonthlySnapshot(month);

    const user = snapshot.users.find((u) => u.id === userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy thành viên');
    }

    const usersById = new Map(snapshot.users.map((u) => [u.id, u]));
    const rank = snapshot.ranksMap.get(userId) || 'C0';
    const f1Ids = snapshot.f1Map.get(userId) || [];
    const personalSales = snapshot.personalSalesMap.get(userId) || 0;
    const groupSales = snapshot.groupSalesMap.get(userId) || 0;

    const currentQualification = this.evaluateRankRequirements(
      rank,
      f1Ids,
      snapshot.ranksMap,
    );
    const nextRank =
      MONTHLY_RANK_PROMOTION_ORDER.find(
        (r) =>
          MONTHLY_RANK_ORDER.indexOf(r) > MONTHLY_RANK_ORDER.indexOf(rank),
      ) || null;
    const nextQualification = nextRank
      ? this.evaluateRankRequirements(nextRank, f1Ids, snapshot.ranksMap)
      : null;

    // Kiểm tra bất biến: sau khi vòng xét thăng cấp hội tụ, không ai còn đủ
    // điều kiện lên cao hơn cấp đang giữ. Nếu cờ này bật thì vòng lặp đã chạm
    // MONTHLY_RANK_PROMOTION_LOOP_LIMIT hoặc dữ liệu cây bất thường.
    let eligibleRank = rank;
    for (const r of MONTHLY_RANK_PROMOTION_ORDER) {
      const q = this.evaluateRankRequirements(r, f1Ids, snapshot.ranksMap);
      if (
        q?.satisfied &&
        MONTHLY_RANK_ORDER.indexOf(r) > MONTHLY_RANK_ORDER.indexOf(eligibleRank)
      ) {
        eligibleRank = r;
      }
    }
    const rankLagging =
      MONTHLY_RANK_ORDER.indexOf(eligibleRank) > MONTHLY_RANK_ORDER.indexOf(rank);

    const currentQualifiedIds = new Set(
      currentQualification?.qualifiedF1Ids || [],
    );
    const nextQualifiedIds = new Set(nextQualification?.qualifiedF1Ids || []);

    const f1List = f1Ids
      .map((id) => {
        const f1 = usersById.get(id);
        const f1PersonalSales = snapshot.personalSalesMap.get(id) || 0;
        const branchSales = snapshot.subtreeSalesMap.get(id) || 0;
        const f1Rank = snapshot.ranksMap.get(id) || 'C0';
        return {
          userId: id,
          username: f1?.username || null,
          email: f1?.email || null,
          rank: f1Rank,
          rankLabel: rankLabel(f1Rank),
          manualRank: f1?.manualRank || null,
          isDaiLy:
            Number(f1?.totalPurchaseAmount || 0) >= DAILY_RANK_MIN_PURCHASE,
          totalPurchaseAmount: Number(f1?.totalPurchaseAmount || 0),
          personalSales: f1PersonalSales,
          branchSales,
          branchMemberCount: snapshot.subtreeCountMap.get(id) || 1,
          f1Count: (snapshot.f1Map.get(id) || []).length,
          countsTowardCurrentRank: currentQualifiedIds.has(id),
          countsTowardNextRank: nextQualifiedIds.has(id),
          sharePercent: groupSales > 0 ? branchSales / groupSales : 0,
        };
      })
      .sort((a, b) => b.branchSales - a.branchSales);

    const appliedRate = snapshot.groupRewardRateMap.get(userId) || 0;
    const tier = GROUP_REWARD_TIERS.find((t) => groupSales >= t.min);
    const rateThisMonth = tier ? tier.rate : 0;
    const prevMonthRate = snapshot.prevRatesMap.get(userId) || 0;

    const poolRate = GLOBAL_SHARE_RATES[rank] || 0;
    const qualifiedSameRank = snapshot.usersByRank.get(rank) || [];

    const storedStats = await this.userMonthlyStatsRepository.findOne({
      where: { userId, month },
    });

    return {
      month,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        manualRank: user.manualRank || null,
        totalPurchaseAmount: Number(user.totalPurchaseAmount || 0),
      },
      rank,
      rankLabel: rankLabel(rank),
      eligibleRank,
      eligibleRankLabel: rankLabel(eligibleRank),
      rankLagging,
      isManualRank: !!user.manualRank && user.manualRank !== 'NONE',
      daiLyCondition: {
        required: DAILY_RANK_MIN_PURCHASE,
        actual: Number(user.totalPurchaseAmount || 0),
        satisfied:
          Number(user.totalPurchaseAmount || 0) >= DAILY_RANK_MIN_PURCHASE,
      },
      currentQualification,
      nextQualification,
      personalSales,
      groupSales,
      totalMemberCount: (snapshot.subtreeCountMap.get(userId) || 1) - 1,
      f1List,
      groupReward: {
        groupSales,
        tierLabel: tier ? tier.label : 'Chưa đạt mốc tối thiểu ($400)',
        rateThisMonth,
        prevMonth: snapshot.prevMonthStr,
        prevMonthRate,
        appliedRate,
        keptFromPrevMonth: appliedRate > rateThisMonth,
        amount: snapshot.groupRewardAmountMap.get(userId) || 0,
      },
      globalShare: {
        rank,
        rankLabel: rankLabel(rank),
        poolRate,
        totalNationalSales: snapshot.totalNationalSales,
        poolAmount: snapshot.totalNationalSales * poolRate,
        qualifiedCount: qualifiedSameRank.length,
        amount: snapshot.globalShareMap.get(userId) || 0,
      },
      stored: storedStats
        ? {
            isProcessed: storedStats.isProcessed,
            personalSales: Number(storedStats.personalSales),
            groupSales: Number(storedStats.groupSales),
            calculatedRank: storedStats.calculatedRank,
            groupRewardRate: Number(storedStats.groupRewardRate),
            groupRewardAmount: Number(storedStats.groupRewardAmount),
            globalShareAmount: Number(storedStats.globalShareAmount),
          }
        : null,
    };
  }

  /**
   * Tiến trình cấp bậc của chính người dùng, dùng cho màn hình profile.
   * Rút gọn từ getMonthlyUserDetail: chỉ giữ phần người dùng cần thấy và
   * không trả email/ID của tuyến dưới.
   */
  async getMyRankProgress(userId: string, month?: string) {
    const targetMonth = month || this.getCurrentMonthString();
    const detail = await this.getMonthlyUserDetail(targetMonth, userId);

    const isRanked =
      detail.rank !== 'C0' && detail.rank !== 'DAILY' && !!detail.rank;

    // Lộ trình đầy đủ để màn hình vẽ được các bậc phía trước, kèm tỷ lệ đồng
    // chia quốc gia của từng bậc.
    const ladder = MONTHLY_RANK_PROMOTION_ORDER.map((rank) => {
      const rules = MONTHLY_RANK_RULES[rank] || [];
      return {
        rank,
        rankLabel: rankLabel(rank),
        globalShareRate: GLOBAL_SHARE_RATES[rank] || 0,
        ruleText: rules
          .map((r) => `${r.count} F1 đạt ${rankLabel(r.rank)} trở lên`)
          .join(' và '),
        achieved:
          MONTHLY_RANK_ORDER.indexOf(detail.rank) >=
          MONTHLY_RANK_ORDER.indexOf(rank),
        isCurrent: detail.rank === rank,
      };
    });

    const stripIds = (qualification: any) =>
      qualification
        ? {
            rank: qualification.rank,
            rankLabel: rankLabel(qualification.rank),
            ruleText: qualification.ruleText,
            satisfied: qualification.satisfied,
            requirements: qualification.requirements.map((r: any) => ({
              requiredRank: r.requiredRank,
              requiredRankLabel: r.requiredRankLabel,
              requiredCount: r.requiredCount,
              actualCount: r.actualCount,
              satisfied: r.satisfied,
            })),
          }
        : null;

    const nextQualification = stripIds(detail.nextQualification);

    return {
      month: detail.month,
      rank: detail.rank,
      rankLabel: detail.rankLabel,
      isRanked,
      isManualRank: detail.isManualRank,
      daiLyCondition: detail.daiLyCondition,
      currentQualification: stripIds(detail.currentQualification),
      nextRank: nextQualification?.rank || null,
      nextRankLabel: nextQualification?.rankLabel || null,
      nextQualification,
      personalSales: detail.personalSales,
      groupSales: detail.groupSales,
      totalMemberCount: detail.totalMemberCount,
      f1Count: detail.f1List.length,
      f1RankCounts: detail.f1List.reduce(
        (acc: Record<string, number>, f1: any) => {
          acc[f1.rank] = (acc[f1.rank] || 0) + 1;
          return acc;
        },
        {},
      ),
      groupReward: {
        tierLabel: detail.groupReward.tierLabel,
        appliedRate: detail.groupReward.appliedRate,
        rateThisMonth: detail.groupReward.rateThisMonth,
        keptFromPrevMonth: detail.groupReward.keptFromPrevMonth,
        amount: detail.groupReward.amount,
      },
      globalShare: {
        poolRate: detail.globalShare.poolRate,
        qualifiedCount: detail.globalShare.qualifiedCount,
        poolAmount: detail.globalShare.poolAmount,
        amount: detail.globalShare.amount,
      },
      ladder,
      isProcessed: detail.stored?.isProcessed ?? false,
    };
  }

  /** Tháng hiện tại theo định dạng YYYY-MM. */
  private getCurrentMonthString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  async getMonthlyStats(month: string) {
    return this.userMonthlyStatsRepository.find({
      where: { month },
      relations: ['user'],
      order: { groupSales: 'DESC' },
    });
  }
}
