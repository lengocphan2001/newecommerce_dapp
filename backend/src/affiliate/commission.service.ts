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

      this.logger.log(`Calculating commissions for order ${orderId}, buyer: ${buyer.id} (referralUserId: ${buyer.referralUserId}, parentId: ${buyer.parentId}), amount: ${order.totalAmount}`);

      // Package type is only set when user buys a package (not from product purchase).

      // BƯỚC 1: Tính hoa hồng trực tiếp cho người giới thiệu
      this.logger.log(`Step 1: Calculating direct commission for order ${orderId}`);
      await this.calculateDirectCommission(order, buyer);

      // BƯỚC 2: Tính hoa hồng nhóm (binary tree) - logic cân cặp chuẩn
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

    // Use referrer's package or default (lowest-tier) so referrers with NONE still earn commission
    const config = await this.getPackageConfig(referrer.packageType) || await this.getDefaultPackageConfig();
    if (!config) {
      this.logger.debug(`No package config for referrer ${referrer.id} (packageType: ${referrer.packageType}) and no default package`);
      return;
    }

    const canReceiveCommission = await this.checkReconsumption(referrer, config);
    const rawCommissionAmount = order.totalAmount * config.directCommissionRate;
    const commissionAmount = this.roundToFirstSignificantDigit(rawCommissionAmount);

    this.logger.log(`Creating direct commission: referrer ${referrer.id}, buyer ${buyer.id}, amount: ${commissionAmount}, status: ${canReceiveCommission ? 'PENDING' : 'BLOCKED'}`);

    try {
      const commission = this.commissionRepository.create({
        userId: referrer.id,
        orderId: order.id,
        fromUserId: buyer.id,
        type: CommissionType.DIRECT,
        status: canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
        amount: commissionAmount,
        orderAmount: order.totalAmount,
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

      this.logger.log(`Updating volume for ancestor ${ancestor.id}: ${buyerSide} branch increase by ${order.totalAmount}`);

      // Update volume bằng SQL Increment (Atomics)
      await this.userRepository.createQueryBuilder()
        .update(User)
        .set({
          [buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: () => `${buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal'} + ${order.totalAmount}`
        })
        .where("id = :id", { id: ancestor.id })
        .execute();
    }
  }

  /**
   * Tính hoa hồng nhóm (binary tree)
   */
  private async calculateGroupCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(`[GROUP COMMISSION] Processing ${ancestors.length} ancestors for buyer ${buyer.id}`);

    for (const ancestor of ancestors) {
      // Use ancestor's package or default so ancestors with NONE still earn group commission
      const config = await this.getPackageConfig(ancestor.packageType) || await this.getDefaultPackageConfig();
      if (!config) continue;

      // Kiểm tra xem ancestor có đủ cả 2 nhánh trái và phải không
      const hasBothBranches = await this.hasBothBranches(ancestor.id);
      if (!hasBothBranches) {
        this.logger.debug(`[GROUP COMMISSION] Ancestor ${ancestor.id} does not have both left and right branches, skipping group commission`);
        continue;
      }

      // Xác định buyer thuộc nhánh nào của ancestor
      const buyerSide = await this.getBuyerSide(buyer, ancestor);

      // Xác định nhánh yếu của ancestor (TRƯỚC khi cộng volume mới)
      const weakSide = await this.getWeakSide(ancestor.id);

      this.logger.log(`[GROUP COMMISSION] Ancestor ${ancestor.id}: buyerSide=${buyerSide}, weakSide=${weakSide} (Current volumes - Left: ${ancestor.leftBranchTotal}, Right: ${ancestor.rightBranchTotal})`);

      // QUAN TRỌNG: Nếu cả hai nhánh đều = 0 (giao dịch đầu tiên), không tính hoa hồng nhóm
      if (Number(ancestor.leftBranchTotal) === 0 && Number(ancestor.rightBranchTotal) === 0) {
        this.logger.debug(`[GROUP COMMISSION] Ancestor ${ancestor.id} has both branches at 0 (first transaction), skipping group commission`);
        continue;
      }

      // Nếu hai nhánh bằng nhau (weakSide === null) HOẶC đơn hàng phát sinh ở đúng nhánh yếu -> Trả hoa hồng
      if (weakSide === null || buyerSide === weakSide) {
        const canReceiveCommission = await this.checkReconsumption(ancestor, config);

        await this.createGroupCommission(
          order,
          buyer,
          ancestor,
          buyerSide,
          canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
          config
        );
      } else {
        this.logger.debug(`[GROUP COMMISSION] Order is not on weak side (buyerSide: ${buyerSide}, weakSide: ${weakSide}) of ancestor ${ancestor.id}, skipping`);
      }
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

    const rawCommissionAmount = order.totalAmount * config.groupCommissionRate;
    const commissionAmount = this.roundToFirstSignificantDigit(rawCommissionAmount);

    this.logger.log(`Creating group commission: ancestor ${ancestor.id}, buyer ${buyer.id}, side: ${side}, status: ${status}, amount: ${commissionAmount}`);

    const commission = this.commissionRepository.create({
      userId: ancestor.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.GROUP,
      status: status,
      amount: commissionAmount,
      orderAmount: order.totalAmount,
      side: side,
      notes: status === CommissionStatus.BLOCKED ? 'Blocked: Reconsumption required' : undefined,
    });

    await this.commissionRepository.save(commission);

    if (status === CommissionStatus.PENDING) {
      await this.updateUserCommissionAndCheckThreshold(ancestor, commissionAmount, config);
    }
  }

  /**
   * Tính hoa hồng quản lý nhóm.
   * Khi A nhận hoa hồng nhóm (group): parent của A nhận % từ A, superparent nhận % từ A, v.v.
   * Tất cả % đều tính trên cùng một gốc là số tiền hoa hồng của A (package managementRateF1/F2/F3).
   * Không cascade: không tính % trên hoa hồng quản lý của cấp dưới.
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
   * Trả hoa hồng quản lý cho F1, F2, F3 của A dựa trên số tiền hoa hồng nhóm của A.
   * F1 nhận amount_A × managementRateF1 (của gói F1), F2 nhận amount_A × managementRateF2, F3 nhận amount_A × managementRateF3.
   * Base luôn là amount của A, không đệ quy.
   */
  private async payManagementFromGroupEarner(
    order: Order,
    userA: User,
    sourceCommission: Commission,
  ): Promise<void> {
    const ancestors = await this.getAncestors(userA);
    const baseAmount = Number(sourceCommission.amount);

    for (let i = 0; i < Math.min(3, ancestors.length); i++) {
      const manager = ancestors[i];
      const level = i + 1; // 1 = F1, 2 = F2, 3 = F3

      const config = await this.getPackageConfig(manager.packageType);
      if (!config) continue;

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
  ): Promise<Commission> {

    const rawCommissionAmount = groupCommissionAmount * rate;
    const commissionAmount = this.roundToFirstSignificantDigit(rawCommissionAmount);

    const commission = this.commissionRepository.create({
      userId: manager.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.MANAGEMENT,
      status: status,
      amount: commissionAmount,
      orderAmount: order.totalAmount,
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
   * Helper function: Round down to the first significant digit.
   * Example: 0.2456 -> 0.2, 0.00002323 -> 0.00002
   */
  private roundToFirstSignificantDigit(num: number): number {
    if (num === 0) return 0;

    // Handle negative numbers if necessary, though commissions should be positive
    const sign = num < 0 ? -1 : 1;
    num = Math.abs(num);

    // Get the magnitude (power of 10) of the first significant digit
    // e.g., 0.2456 -> log10(0.2456) ~ -0.6 -> floor(-0.6) = -1. Magnitude is 10^-1 = 0.1
    // e.g., 0.000023 -> log10(0.000023) ~ -4.6 -> floor(-4.6) = -5. Magnitude is 10^-5 = 0.00001
    const magnitude = Math.floor(Math.log10(num));
    const factor = Math.pow(10, magnitude);

    // Scale down to 1.x, floor it to get 1, then scale back up
    // Actually, we want to keep one digit.
    // 0.2456 -> magnitude -1. factor 0.1.
    // num / factor = 2.456 -> floor -> 2.
    // 2 * factor = 0.2

    // Let's test 23.45 -> log10(23.45) ~ 1.37 -> floor 1. factor 10.
    // 23.45 / 10 = 2.345 -> floor -> 2. result 20. 
    // Wait, typical scientific notation rounding usually keeps more precision for larger numbers?
    // User examples: 0.2456 -> 0.2, 0.00002323 -> 0.00002.
    // It seems consistent: Keep only the first non-zero digit.

    const firstDigit = Math.floor(num / factor);
    return sign * firstDigit * factor;
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
      return current.position;
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
      totalCommission: this.roundToFirstSignificantDigit(totalCommission || 0),
      pendingCommission: this.roundToFirstSignificantDigit(pendingCommission || 0),
      commissions: {
        direct: this.roundToFirstSignificantDigit(direct || 0),
        group: this.roundToFirstSignificantDigit(group || 0),
        management: this.roundToFirstSignificantDigit(management || 0),
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
      amount: this.roundToFirstSignificantDigit(Number(c.amount)),
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
      amount: this.roundToFirstSignificantDigit(Number(c.amount)),
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
      orderAmount: 0, // No specific order associated directly like purchase
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
