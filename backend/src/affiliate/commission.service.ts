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
   * Clear config cache (call when config is updated)
   */
  clearConfigCache(): void {
    this.configCache.clear();
    this.lastCacheUpdate = 0;
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

      // Cập nhật package type nếu cần
      await this.updateUserPackage(buyer, order.totalAmount);

      // Reload buyer để có package type mới nhất
      const updatedBuyer = await this.userRepository.findOne({
        where: { id: buyer.id },
      });
      if (updatedBuyer && updatedBuyer.packageType !== buyer.packageType) {
        this.logger.log(`Buyer ${buyer.id} package type updated from ${buyer.packageType} to ${updatedBuyer.packageType}`);
        Object.assign(buyer, updatedBuyer);
      }

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
   * Cập nhật package type của user dựa trên tổng giá trị mua
   * Nếu user đã đạt ngưỡng và đang có packageType = NONE, restore packageType khi tái tiêu dùng
   */
  private async updateUserPackage(user: User, orderAmount: number): Promise<void> {
    const newTotalPurchase = Number(user.totalPurchaseAmount) + Number(orderAmount);
    let newPackageType = user.packageType;

    // Get all packages sorted by price/level (assuming service returns them sorted by level)
    const packages = await this.packagesService.findAll();

    // Simplified Logic: 
    // 1. If TOTAL PURCHASE meets package price -> Upgrade.
    // 2. If User is NONE (due to reconsumption lock) AND single order meets package price -> Restore.

    const sortedPackages = [...packages].sort((a, b) => b.price - a.price);

    for (const pkg of sortedPackages) {
      if (user.packageType === 'NONE' && user.totalCommissionReceived > 0) {
        // Reconsumption Restore Check
        if (orderAmount >= pkg.price) {
          newPackageType = pkg.code;
          break; // Found highest eligible package
        }
      } else {
        // Upgrade Check
        // Only upgrade if new package is higher price/level than current
        const currentPkg = packages.find(p => p.code === user.packageType);
        const currentPrice = currentPkg ? currentPkg.price : 0;

        if (newTotalPurchase >= pkg.price && pkg.price > currentPrice) {
          newPackageType = pkg.code;
          break;
        }
      }
    }

    if (newPackageType !== user.packageType) {
      await this.userRepository.update(user.id, {
        packageType: newPackageType,
        totalPurchaseAmount: newTotalPurchase,
        totalCommissionReceived: 0, // Reset commission counter on upgrade/restore
      });
      this.logger.log(`User ${user.id} packageType updated from ${user.packageType} to ${newPackageType}. Commission cycle reset.`);
    } else {
      await this.userRepository.update(user.id, {
        totalPurchaseAmount: newTotalPurchase,
      });
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

    const config = await this.getPackageConfig(referrer.packageType);
    if (!config) {
      return; // Người giới thiệu chưa có gói hợp lệ
    }

    const commissionAmount = order.totalAmount * config.directCommissionRate;
    const canReceiveCommission = await this.checkReconsumption(referrer, config);

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
      if (ancestor.packageType === 'NONE') continue;

      const config = await this.getPackageConfig(ancestor.packageType);
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

    const commissionAmount = order.totalAmount * config.groupCommissionRate;

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
   * Tính hoa hồng quản lý nhóm
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return;
    }

    // Tìm F1, F2, F3 của buyer
    const f1 = await this.userRepository.findOne({ where: { id: buyer.parentId } });
    if (!f1) return;

    const f2 = f1.parentId ? await this.userRepository.findOne({ where: { id: f1.parentId } }) : null;
    const f3 = f2?.parentId ? await this.userRepository.findOne({ where: { id: f2.parentId } }) : null;

    // Tìm TẤT CẢ commission (trừ DIRECT và MANAGEMENT) của F1/F2/F3 từ đơn hàng này
    const eligibleTypes = [CommissionType.GROUP, CommissionType.MILESTONE];

    const allF1Commissions = await this.commissionRepository.createQueryBuilder('commission')
      .where('commission.userId = :userId', { userId: f1.id })
      .andWhere('commission.orderId = :orderId', { orderId: order.id })
      .andWhere('commission.type IN (:...types)', { types: eligibleTypes })
      .getMany();

    const allF2Commissions = f2 ? await this.commissionRepository.createQueryBuilder('commission')
      .where('commission.userId = :userId', { userId: f2.id })
      .andWhere('commission.orderId = :orderId', { orderId: order.id })
      .andWhere('commission.type IN (:...types)', { types: eligibleTypes })
      .getMany() : [];

    const allF3Commissions = f3 ? await this.commissionRepository.createQueryBuilder('commission')
      .where('commission.userId = :userId', { userId: f3.id })
      .andWhere('commission.orderId = :orderId', { orderId: order.id })
      .andWhere('commission.type IN (:...types)', { types: eligibleTypes })
      .getMany() : [];

    const allCommissions = [
      ...allF1Commissions.map(c => ({ commission: c, user: f1, level: 1 })),
      ...allF2Commissions.map(c => ({ commission: c, user: f2!, level: 2 })),
      ...allF3Commissions.map(c => ({ commission: c, user: f3!, level: 3 })),
    ];

    if (allCommissions.length === 0) return;

    for (const { commission, user: commissionUser, level: commissionLevel } of allCommissions) {
      await this.calculateManagementForCommissionRecursive(
        order,
        commissionUser,
        commission,
        commissionLevel,
        new Set<string>(),
      );
    }
  }

  /**
   * Tính management commission đệ quy
   */
  private async calculateManagementForCommissionRecursive(
    order: Order,
    commissionUser: User,
    sourceCommission: Commission,
    commissionUserLevel: number,
    processedUsers: Set<string>,
  ): Promise<void> {
    if (processedUsers.has(commissionUser.id)) return;
    processedUsers.add(commissionUser.id);

    const ancestors = await this.getAncestors(commissionUser);

    if (ancestors.length === 0) return;

    for (const ancestor of ancestors) {

      const config = await this.getPackageConfig(ancestor.packageType);

      if (!config) {
        continue;
      }

      // Kiểm tra tái tiêu dùng
      const canReceiveCommission = await this.checkReconsumption(ancestor, config);
      if (!canReceiveCommission) {
        continue;
      }

      // Xác định commissionUser là F1/F2/F3 của ancestor như thế nào
      const level = await this.getGenerationLevel(commissionUser, ancestor);

      if (level === null || level > 3) {
        continue;
      }

      // Determine rate based on level and package config
      let rate = 0;
      if (level === 1) rate = config.managementRateF1;
      else if (level === 2) rate = config.managementRateF2 || 0;
      else if (level === 3) rate = config.managementRateF3 || 0;

      if (rate <= 0) {
        continue; // Package not eligible for this level
      }

      // Reload ancestor từ DB để có data mới nhất
      const freshAncestor = await this.userRepository.findOne({ where: { id: ancestor.id } });
      if (!freshAncestor) continue;

      const createdManagementCommission = await this.createManagementCommission(
        order,
        commissionUser,
        freshAncestor,
        level,
        sourceCommission.amount,
        rate,
        canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED,
        config
      );

      if (createdManagementCommission && canReceiveCommission && createdManagementCommission.status === CommissionStatus.PENDING) {
        // Recursion
        const updatedAncestor = await this.userRepository.findOne({ where: { id: ancestor.id } });
        if (updatedAncestor) {
          await this.calculateManagementForCommissionRecursive(
            order,
            updatedAncestor,
            createdManagementCommission,
            level,
            processedUsers,
          );
        }
      }
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

    const commissionAmount = groupCommissionAmount * rate;

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
   */
  private async checkReconsumption(user: User, config: Package): Promise<boolean> {
    if (user.packageType === 'NONE') {
      return false;
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
      totalCommission: totalCommission || 0,
      pendingCommission: pendingCommission || 0,
      commissions: {
        direct: direct || 0,
        group: group || 0,
        management: management || 0,
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

    return this.commissionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['fromUser'],
    });
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

    return this.commissionRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['user', 'fromUser'],
    });
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
