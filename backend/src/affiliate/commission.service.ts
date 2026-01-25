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
import { CommissionConfigService } from '../admin/commission-config.service';
import { PackageType } from '../admin/entities/commission-config.entity';
import { formatDecimalsInObject } from '../common/utils/number.util';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);
  private configCache: Map<string, any> = new Map(); // Changed to string key
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
    @Inject(forwardRef(() => CommissionConfigService))
    private configService: CommissionConfigService,
  ) {}

  /**
   * Get commission config for a package type (with caching)
   */
  private async getConfig(packageType: 'CTV' | 'NPP'): Promise<any> {
    const now = Date.now();
    
    // Check cache
    if (this.configCache.has(packageType) && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.configCache.get(packageType);
    }

    // Load from database
    const config = await this.configService.findByPackageType(
      packageType === 'CTV' ? PackageType.CTV : PackageType.NPP,
    );

    if (!config) {
      // Fallback to defaults if config not found
      const defaults = packageType === 'CTV' 
        ? {
            DIRECT_RATE: 0.2,
            GROUP_RATE: 0.1,
            MANAGEMENT_RATE: 0.15,
            MANAGEMENT_RATES: { F1: 0.15, F2: null, F3: null },
            PACKAGE_VALUE: 0.0001,
            RECONSUMPTION_THRESHOLD: 0.001,
            RECONSUMPTION_REQUIRED: 0.0001,
          }
        : {
            DIRECT_RATE: 0.25,
            GROUP_RATE: 0.15,
            MANAGEMENT_RATE: 0.15,
            MANAGEMENT_RATES: { F1: 0.15, F2: 0.1, F3: 0.1 },
            PACKAGE_VALUE: 0.001,
            RECONSUMPTION_THRESHOLD: 0.01,
            RECONSUMPTION_REQUIRED: 0.001,
          };
      this.configCache.set(packageType, defaults);
      this.lastCacheUpdate = now;
      return defaults;
    }

    // Convert database config to format expected by code
    const formattedConfig = {
      DIRECT_RATE: parseFloat(config.directRate.toString()),
      GROUP_RATE: parseFloat(config.groupRate.toString()),
      MANAGEMENT_RATE: parseFloat(config.managementRateF1.toString()),
      MANAGEMENT_RATES: {
        F1: parseFloat(config.managementRateF1.toString()),
        F2: config.managementRateF2 ? parseFloat(config.managementRateF2.toString()) : null,
        F3: config.managementRateF3 ? parseFloat(config.managementRateF3.toString()) : null,
      },
      PACKAGE_VALUE: parseFloat(config.packageValue.toString()),
      RECONSUMPTION_THRESHOLD: parseFloat(config.reconsumptionThreshold.toString()),
      RECONSUMPTION_REQUIRED: parseFloat(config.reconsumptionRequired.toString()),
    };

    this.configCache.set(packageType, formattedConfig);
    this.lastCacheUpdate = now;
    return formattedConfig;
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
    const newTotalPurchase = user.totalPurchaseAmount + orderAmount;

    let newPackageType: 'NONE' | 'CTV' | 'NPP' = user.packageType;

    const nppConfig = await this.getConfig('NPP');
    const ctvConfig = await this.getConfig('CTV');
    
    // Nếu user đang có packageType = NONE và đã đạt ngưỡng, có thể là tái tiêu dùng
    // Restore packageType dựa trên orderAmount
    if (user.packageType === 'NONE' && user.totalCommissionReceived >= ctvConfig.RECONSUMPTION_THRESHOLD) {
      // User đã đạt ngưỡng, nếu mua hàng với giá trị >= packageValue → restore packageType
      if (orderAmount >= nppConfig.PACKAGE_VALUE) {
        newPackageType = 'NPP';
      } else if (orderAmount >= ctvConfig.PACKAGE_VALUE) {
        newPackageType = 'CTV';
      }
    } else {
      // Logic bình thường: cập nhật packageType dựa trên tổng giá trị mua
      if (newTotalPurchase >= nppConfig.PACKAGE_VALUE) {
        newPackageType = 'NPP';
      } else if (newTotalPurchase >= ctvConfig.PACKAGE_VALUE) {
        newPackageType = 'CTV';
      }
    }

    if (newPackageType !== user.packageType) {
      await this.userRepository.update(user.id, {
        packageType: newPackageType,
        totalPurchaseAmount: newTotalPurchase,
      });
      this.logger.log(`User ${user.id} packageType updated from ${user.packageType} to ${newPackageType}`);
    } else {
      await this.userRepository.update(user.id, {
        totalPurchaseAmount: newTotalPurchase,
      });
    }
  }

  /**
   * Tính hoa hồng trực tiếp: CTV 20%, NPP 25%
   * Hoa hồng trực tiếp được tính cho người giới thiệu ban đầu (referralUserId),
   * KHÔNG phụ thuộc vào nhánh yếu - TẤT CẢ giao dịch của người được giới thiệu trực tiếp đều tính hoa hồng
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

    if (referrer.packageType === 'NONE') {
      return; // Người giới thiệu chưa có gói
    }

    // LƯU Ý: Hoa hồng trực tiếp được tính cho TẤT CẢ giao dịch
    // Điều kiện tái tiêu dùng chỉ áp dụng SAU KHI đã đạt ngưỡng hoa hồng
    // Kiểm tra tái tiêu dùng SAU KHI tính hoa hồng (xem có đạt ngưỡng không)
    // Nếu đạt ngưỡng và chưa đủ tái tiêu dùng, thì KHÔNG tính hoa hồng này
    const config = await this.getConfig(
      referrer.packageType === 'NPP' ? 'NPP' : 'CTV'
    );

    const commissionAmount = order.totalAmount * config.DIRECT_RATE;
    const canReceiveCommission = await this.checkReconsumption(referrer);

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
        // Cập nhật tổng hoa hồng đã nhận bằng SQL Increment để tránh Race Condition và sai số
        await this.userRepository.createQueryBuilder()
          .update(User)
          .set({ 
            totalCommissionReceived: () => `totalCommissionReceived + ${commissionAmount}` 
          })
          .where("id = :id", { id: referrer.id })
          .execute();
        
        // Kiểm tra xem có đạt ngưỡng không, nếu có thì set packageType về NONE
        const updatedReferrer = await this.userRepository.findOne({ where: { id: referrer.id } });
        if (updatedReferrer) {
          const newTotalCommission = updatedReferrer.totalCommissionReceived;
          const threshold = config.RECONSUMPTION_THRESHOLD;
          if (newTotalCommission >= threshold) {
            // Đã đạt ngưỡng → set packageType về NONE
            await this.userRepository.update(referrer.id, {
              packageType: 'NONE',
            });
            this.logger.log(`User ${referrer.id} reached threshold ${threshold}, packageType set to NONE`);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Error creating direct commission for referrer ${referrer.id}, buyer ${buyer.id}:`, error.stack || error.message);
      throw error; // Re-throw để có thể xử lý ở trên
    }
  }

  /**
   * Update volume cho TẤT CẢ ancestors trong binary tree
   * Volume phải được update TRƯỚC KHI tính commission để đảm bảo weakSide được tính đúng
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
   * Logic CHUẨN:
   * 1. Mỗi Ancestor chỉ nhận hoa hồng nếu đơn hàng phát sinh ở nhánh yếu CỦA CHÍNH HỌ.
   * 2. Tránh trùng lặp hoa hồng cho parent (chỉ lặp qua ancestors một lần).
   */
  private async calculateGroupCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(`[GROUP COMMISSION] Processing ${ancestors.length} ancestors for buyer ${buyer.id}`);

    for (const ancestor of ancestors) {
      if (ancestor.packageType === 'NONE') continue;

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
      if (ancestor.leftBranchTotal === 0 && ancestor.rightBranchTotal === 0) {
        this.logger.debug(`[GROUP COMMISSION] Ancestor ${ancestor.id} has both branches at 0 (first transaction), skipping group commission`);
        continue;
      }

      // Nếu hai nhánh bằng nhau (weakSide === null) HOẶC đơn hàng phát sinh ở đúng nhánh yếu -> Trả hoa hồng
      if (weakSide === null || buyerSide === weakSide) {
        const canReceiveCommission = await this.checkReconsumption(ancestor);
        
        await this.createGroupCommission(
          order, 
          buyer, 
          ancestor, 
          buyerSide, 
          canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED
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
  ): Promise<void> {
    const config = await this.getConfig(
      ancestor.packageType === 'NPP' ? 'NPP' : 'CTV'
    );

    const commissionAmount = order.totalAmount * config.GROUP_RATE;

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
      // Cập nhật tổng hoa hồng đã nhận bằng SQL Increment
      await this.userRepository.createQueryBuilder()
        .update(User)
        .set({ 
          totalCommissionReceived: () => `totalCommissionReceived + ${commissionAmount}` 
        })
        .where("id = :id", { id: ancestor.id })
        .execute();
      
      // Kiểm tra xem có đạt ngưỡng không, nếu có thì set packageType về NONE
      const updatedAncestor = await this.userRepository.findOne({ where: { id: ancestor.id } });
      if (updatedAncestor) {
        const newTotalCommission = updatedAncestor.totalCommissionReceived;
        const config = await this.getConfig(ancestor.packageType === 'NPP' ? 'NPP' : 'CTV');
        if (newTotalCommission >= config.RECONSUMPTION_THRESHOLD) {
          // Đã đạt ngưỡng → set packageType về NONE
          await this.userRepository.update(ancestor.id, {
            packageType: 'NONE',
          });
          this.logger.log(`User ${ancestor.id} reached threshold ${config.RECONSUMPTION_THRESHOLD}, packageType set to NONE`);
        }
      }
    }
  }

  /**
   * Tính hoa hồng quản lý nhóm
   * CTV: 15% trên hoa hồng nhóm mà F1 nhận được
   * NPP: 15% trên hoa hồng nhóm F1, 10% trên hoa hồng nhóm F2, 10% trên hoa hồng nhóm F3
   * 
   * Logic:
   * - F1 của User A = các user trực tiếp dưới A trong binary tree (left child và right child)
   * - F2 của User A = các user ở cấp thứ 2 dưới A (con của F1)
   * - F3 của User A = các user ở cấp thứ 3 dưới A (con của F2)
   * 
   * QUAN TRỌNG: Tính đệ quy - mỗi khi một user nhận commission (trừ DIRECT), 
   * ancestors của user đó cũng nhận management commission từ commission đó
   * - Tìm F1, F2, F3 của buyer
   * - Tìm TẤT CẢ commission (GROUP, MILESTONE, ...) của F1/F2/F3 từ đơn hàng này
   * - Với mỗi commission, tính management cho ancestors
   * - Khi một user nhận management commission, tiếp tục tính management cho ancestors của user đó
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return; // Buyer không có parent trong binary tree
    }

    // Tìm F1, F2, F3 của buyer
    const f1 = await this.userRepository.findOne({
      where: { id: buyer.parentId },
    });
    if (!f1) {
      this.logger.warn(`F1 (parent ${buyer.parentId}) not found`);
      return;
    }

    const f2 = f1.parentId ? await this.userRepository.findOne({
      where: { id: f1.parentId },
    }) : null;

    const f3 = f2?.parentId ? await this.userRepository.findOne({
      where: { id: f2.parentId },
    }) : null;

    // Tìm TẤT CẢ commission (trừ DIRECT và MANAGEMENT) của F1/F2/F3 từ đơn hàng này
    // Các loại commission có thể tính management: GROUP, MILESTONE, ...
    const eligibleTypes = [CommissionType.GROUP, CommissionType.MILESTONE];
    
    const allF1Commissions = await this.commissionRepository
      .createQueryBuilder('commission')
      .where('commission.userId = :userId', { userId: f1.id })
      .andWhere('commission.orderId = :orderId', { orderId: order.id })
      .andWhere('commission.type IN (:...types)', { types: eligibleTypes })
      .getMany();

    const allF2Commissions = f2 ? await this.commissionRepository
      .createQueryBuilder('commission')
      .where('commission.userId = :userId', { userId: f2.id })
      .andWhere('commission.orderId = :orderId', { orderId: order.id })
      .andWhere('commission.type IN (:...types)', { types: eligibleTypes })
      .getMany() : [];

    const allF3Commissions = f3 ? await this.commissionRepository
      .createQueryBuilder('commission')
      .where('commission.userId = :userId', { userId: f3.id })
      .andWhere('commission.orderId = :orderId', { orderId: order.id })
      .andWhere('commission.type IN (:...types)', { types: eligibleTypes })
      .getMany() : [];

    const allCommissions = [
      ...allF1Commissions.map(c => ({ commission: c, user: f1, level: 1 })),
      ...allF2Commissions.map(c => ({ commission: c, user: f2!, level: 2 })),
      ...allF3Commissions.map(c => ({ commission: c, user: f3!, level: 3 })),
    ];

    if (allCommissions.length === 0) {
      this.logger.debug(`[MANAGEMENT COMMISSION] No eligible commissions found for F1/F2/F3 from order ${order.id}, skipping management commission`);
      return;
    }

    this.logger.log(`[MANAGEMENT COMMISSION] Found ${allCommissions.length} eligible commission(s) for F1/F2/F3, calculating management commission recursively`);

    // Với mỗi commission của F1/F2/F3, tính management cho ancestors (đệ quy)
    for (const { commission, user: commissionUser, level: commissionLevel } of allCommissions) {
      this.logger.log(`[MANAGEMENT COMMISSION] Processing commission ${commission.id} (type: ${commission.type}, amount: ${commission.amount}) from F${commissionLevel} (${commissionUser.id})`);
      
      // Tính management commission đệ quy: với mỗi commission, tính management cho ancestors
      // và tiếp tục tính management cho ancestors của những người nhận management
      await this.calculateManagementForCommissionRecursive(
        order,
        commissionUser,
        commission,
        commissionLevel,
        new Set<string>(), // Track processed users to avoid infinite loops
      );
    }
  }

  /**
   * Tính management commission đệ quy cho một commission cụ thể
   * - Tìm ancestors của commissionUser
   * - Với mỗi ancestor, nếu commissionUser là F1/F2/F3 của ancestor, tính management
   * - Nếu ancestor cũng nhận được management commission, tiếp tục tính cho ancestors của ancestor
   */
  private async calculateManagementForCommissionRecursive(
    order: Order,
    commissionUser: User,
    sourceCommission: Commission,
    commissionUserLevel: number, // F1/F2/F3 của buyer ban đầu
    processedUsers: Set<string>, // Track để tránh vòng lặp vô hạn
  ): Promise<void> {
    // Tránh vòng lặp vô hạn
    if (processedUsers.has(commissionUser.id)) {
      this.logger.debug(`[MANAGEMENT COMMISSION] User ${commissionUser.id} already processed, skipping to avoid infinite loop`);
      return;
    }
    processedUsers.add(commissionUser.id);

    // Tìm tất cả ancestors của commissionUser
    const ancestors = await this.getAncestors(commissionUser);
    this.logger.log(`[MANAGEMENT COMMISSION] Found ${ancestors.length} ancestors for commissionUser ${commissionUser.id}, will check management commission for each`);

    if (ancestors.length === 0) {
      return; // Không có ancestors, dừng đệ quy
    }

    for (const ancestor of ancestors) {
      this.logger.log(`[MANAGEMENT COMMISSION] Processing ancestor ${ancestor.id} (packageType: ${ancestor.packageType}) for commissionUser ${commissionUser.id}`);
      
      if (ancestor.packageType === 'NONE') {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - packageType is NONE`);
        continue;
      }

      // Kiểm tra tái tiêu dùng
      const canReceiveCommission = await this.checkReconsumption(ancestor);
      if (!canReceiveCommission) {
        this.logger.warn(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - cannot receive commission (reconsumption check failed)`);
        continue;
      }

      // Xác định commissionUser là F1/F2/F3 của ancestor như thế nào
      const level = await this.getGenerationLevel(commissionUser, ancestor);
      this.logger.log(`[MANAGEMENT COMMISSION] CommissionUser ${commissionUser.id} (F${commissionUserLevel} of buyer) is F${level} of ancestor ${ancestor.id}`);

      if (level === null || level > 3) {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - commissionUser is not F1/F2/F3 (level: ${level})`);
        continue;
      }

      // CTV chỉ nhận hoa hồng quản lý từ F1
      if (ancestor.packageType === 'CTV' && level !== 1) {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - CTV only receives from F1, but commissionUser is F${level}`);
        continue;
      }

      // NPP nhận hoa hồng quản lý từ F1, F2, F3
      if (ancestor.packageType === 'NPP' && level > 3) {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - NPP only receives from F1/F2/F3, but commissionUser is F${level}`);
        continue;
      }

      // Reload ancestor từ DB để có data mới nhất
      const freshAncestor = await this.userRepository.findOne({
        where: { id: ancestor.id },
      });
      if (!freshAncestor) {
        this.logger.warn(`[MANAGEMENT COMMISSION] Ancestor ${ancestor.id} not found in DB`);
        continue;
      }

      // Tính hoa hồng quản lý dựa trên sourceCommission
      this.logger.log(`[MANAGEMENT COMMISSION] Calculating management commission for ancestor ${ancestor.id} based on commission ${sourceCommission.id} (type: ${sourceCommission.type}, amount: ${sourceCommission.amount}) from commissionUser ${commissionUser.id}`);
      
      const createdManagementCommission = await this.calculateManagementForLevel(
        order,
        commissionUser, 
        freshAncestor,
        level,
        sourceCommission.amount,
        canReceiveCommission ? CommissionStatus.PENDING : CommissionStatus.BLOCKED
      );

      // QUAN TRỌNG: Nếu ancestor nhận được management commission, tiếp tục tính management cho ancestors của ancestor
      // Chỉ tiếp tục nếu management commission được tạo thành công và có status PENDING
      if (createdManagementCommission && canReceiveCommission && createdManagementCommission.status === CommissionStatus.PENDING) {
        this.logger.log(`[MANAGEMENT COMMISSION] Ancestor ${ancestor.id} received management commission ${createdManagementCommission.id}, continuing recursively`);
        
        // Reload ancestor để có data mới nhất
        const updatedAncestor = await this.userRepository.findOne({
          where: { id: ancestor.id },
        });
        
        if (updatedAncestor) {
          // Tiếp tục tính management cho ancestors của ancestor (đệ quy)
          await this.calculateManagementForCommissionRecursive(
            order,
            updatedAncestor,
            createdManagementCommission,
            level, // level của ancestor so với ancestor của nó
            processedUsers, // Pass cùng Set để tránh vòng lặp
          );
        }
      }
    }
  }

  /**
   * Xác định buyer là F1/F2/F3 của ancestor như thế nào
   * Trả về: 1 (F1), 2 (F2), 3 (F3), hoặc null nếu không phải F1/F2/F3
   */
  private async getGenerationLevel(
    buyer: User,
    ancestor: User,
  ): Promise<number | null> {
    let current: User | null = buyer;
    let level = 0;

    // Đếm số cấp từ buyer lên ancestor
    while (current && current.parentId && level < 3) {
      level++;
      if (current.parentId === ancestor.id) {
        return level; // Tìm thấy ancestor ở cấp level
      }
      current = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
    }

    return null; // Không tìm thấy ancestor trong 3 cấp đầu
  }

  /**
   * Tính hoa hồng quản lý cho một cấp độ cụ thể
   * Note: Tái tiêu dùng đã được kiểm tra ở calculateManagementCommission, không cần kiểm tra lại ở đây
   * @returns Commission đã tạo, hoặc null nếu không tạo được
   */
  private async calculateManagementForLevel(
    order: Order,
    buyer: User,
    manager: User,
    level: number,
    groupCommissionAmount: number,
    status: CommissionStatus,
  ): Promise<Commission | null> {
    let rate: number;
    if (manager.packageType === 'CTV') {
      const ctvConfig = await this.getConfig('CTV');
      rate = ctvConfig.MANAGEMENT_RATE; // 15%
    } else if (manager.packageType === 'NPP') {
      const nppConfig = await this.getConfig('NPP');
      const fKey = `F${level}` as 'F1' | 'F2' | 'F3';
      rate = nppConfig.MANAGEMENT_RATES[fKey] || 0;
    } else {
      return null;
    }

    // Tính hoa hồng quản lý dựa trên hoa hồng nhóm mà F1/F2/F3 nhận được
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
      // Cập nhật tổng hoa hồng đã nhận bằng SQL Increment
      await this.userRepository.createQueryBuilder()
        .update(User)
        .set({ 
          totalCommissionReceived: () => `totalCommissionReceived + ${commissionAmount}` 
        })
        .where("id = :id", { id: manager.id })
        .execute();
      
      // Kiểm tra xem có đạt ngưỡng không, nếu có thì set packageType về NONE
      const updatedManager = await this.userRepository.findOne({ where: { id: manager.id } });
      if (updatedManager) {
        const newTotalCommission = updatedManager.totalCommissionReceived;
        const config = await this.getConfig(manager.packageType === 'NPP' ? 'NPP' : 'CTV');
        if (newTotalCommission >= config.RECONSUMPTION_THRESHOLD) {
          // Đã đạt ngưỡng → set packageType về NONE
          await this.userRepository.update(manager.id, {
            packageType: 'NONE',
          });
          this.logger.log(`User ${manager.id} reached threshold ${config.RECONSUMPTION_THRESHOLD}, packageType set to NONE`);
        }
      }
    }

    return commission;
  }

  /**
   * Kiểm tra điều kiện tái tiêu dùng
   * Trả về true nếu có thể nhận hoa hồng, false nếu cần tái tiêu dùng
   * 
   * Logic mới (đơn giản hóa):
   * - Nếu chưa đạt ngưỡng hoa hồng → có thể nhận hoa hồng bình thường
   * - Nếu đã đạt ngưỡng → phải mua hàng với giá trị >= packageValue để tiếp tục nhận hoa hồng
   *   - Nếu đã mua hàng với giá trị >= packageValue sau khi đạt ngưỡng → có thể nhận hoa hồng
   *   - Nếu chưa mua → không thể nhận hoa hồng (packageType sẽ bị set về NONE)
   * 
   * QUAN TRỌNG: Chỉ tính các commission (direct, group, management), KHÔNG tính milestone
   */
  private async checkReconsumption(user: User): Promise<boolean> {
    if (user.packageType === 'NONE') {
      return false;
    }

    const config = await this.getConfig(
      user.packageType === 'NPP' ? 'NPP' : 'CTV'
    );

    const threshold = config.RECONSUMPTION_THRESHOLD;
    const packageValue = config.PACKAGE_VALUE;

    this.logger.debug(`[RECONSUMPTION CHECK] User ${user.id}: totalCommissionReceived=${user.totalCommissionReceived}, threshold=${threshold}`);

    // Nếu chưa đạt ngưỡng hoa hồng → có thể nhận hoa hồng bình thường
    if (user.totalCommissionReceived < threshold) {
      return true;
    }

    // Đã đạt ngưỡng → phải kiểm tra tái tiêu dùng
    // User cần mua hàng với giá trị >= packageValue để tiếp tục nhận hoa hồng
    // Kiểm tra xem có đơn hàng tái tiêu dùng nào với giá trị >= packageValue sau khi đạt ngưỡng không
    const hasReconsumed = user.totalReconsumptionAmount >= packageValue;

    this.logger.debug(`[RECONSUMPTION CHECK] User ${user.id}: threshold=${threshold}, packageValue=${packageValue}, totalReconsumptionAmount=${user.totalReconsumptionAmount}, hasReconsumed=${hasReconsumed}`);

    return hasReconsumed;
  }

  /**
   * Lấy tất cả ancestors của một user trong cây nhị phân
   */
  private async getAncestors(user: User): Promise<User[]> {
    const ancestors: User[] = [];
    let current = user;

    while (current.parentId) {
      const parent = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
      if (!parent) break;
      ancestors.push(parent);
      current = parent;
    }

    return ancestors;
  }

  /**
   * Xác định nhánh yếu (nhánh có tổng doanh số thấp hơn)
   * Nếu cả hai nhánh bằng nhau (có thể cả 2 = 0 hoặc cả 2 > 0 và bằng nhau), trả về null
   * Reload user từ DB để có volume mới nhất
   * 
   * LƯU Ý: Giao dịch đầu tiên (cả 2 nhánh = 0) sẽ không được tính hoa hồng nhóm
   * Logic này được xử lý ở calculateGroupCommission
   */
  private async getWeakSide(userId: string): Promise<'left' | 'right' | null> {
    // Reload user từ DB để có volume mới nhất
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'leftBranchTotal', 'rightBranchTotal'],
    });

    if (!user) {
      return null;
    }

    // Nếu hai nhánh bằng nhau -> Không có nhánh yếu
    if (user.leftBranchTotal === user.rightBranchTotal) {
      return null;
    }
    
    // So sánh tổng doanh số
    if (user.leftBranchTotal < user.rightBranchTotal) {
      return 'left';
    }
    return 'right';
  }

  /**
   * Kiểm tra xem user có đủ cả 2 nhánh trái và phải không
   * Trả về true nếu có cả left child và right child, false nếu thiếu một trong hai
   */
  private async hasBothBranches(userId: string): Promise<boolean> {
    const leftChild = await this.userRepository.findOne({
      where: { parentId: userId, position: 'left' },
    });

    const rightChild = await this.userRepository.findOne({
      where: { parentId: userId, position: 'right' },
    });

    return !!(leftChild && rightChild);
  }

  /**
   * Xác định buyer nằm ở nhánh nào của ancestor
   */
  private async getBuyerSide(
    buyer: User,
    ancestor: User,
  ): Promise<'left' | 'right'> {
    let current: User | null = buyer;

    // Tìm direct child của ancestor mà buyer thuộc về
    while (current && current.parentId) {
      if (current.parentId === ancestor.id) {
        // Tìm thấy direct child của ancestor
        const side = current.position || 'left';
        this.logger.debug(`Buyer ${buyer.id} is on ${side} side of ancestor ${ancestor.id} (direct child: ${current.id})`);
        return side;
      }
      const parent = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
      if (!parent) break;
      current = parent;
    }

    // Fallback: nếu không tìm thấy, trả về left
    this.logger.warn(`Could not determine buyer ${buyer.id} side for ancestor ${ancestor.id}, defaulting to left`);
    return 'left';
  }

  /**
   * Lấy lịch sử hoa hồng của user
   */
  async getCommissions(
    userId: string,
    query: { type?: CommissionType; status?: CommissionStatus },
  ): Promise<Commission[]> {
    // Use find() instead of QueryBuilder to ensure all columns are selected
    const where: any = { userId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    const commissions = await this.commissionRepository.find({
      where,
      relations: ['fromUser'],
      order: { createdAt: 'DESC' },
    });
    
    // Format decimal numbers to fix floating-point precision issues
    // formatDecimalsInObject should preserve Date objects, but let's be safe
    const formatted = formatDecimalsInObject(commissions) as Commission[];
    
    // Ensure createdAt is preserved (formatDecimalsInObject might convert Date to string)
    formatted.forEach((c, index) => {
      const original = commissions[index];
      if (original && original.createdAt) {
        // Preserve the original Date object
        (c as any).createdAt = original.createdAt;
      }
    });
    
    return formatted;
  }

  /**
   * Lấy thống kê hoa hồng của user
   */
  async getStats(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const commissions = await this.commissionRepository.find({
      where: { userId },
    });

    // Helper function to format decimal numbers with full precision
    // Returns as string to preserve all decimal places (up to 18 digits)
    const formatDecimal = (value: number | string): string => {
      if (value === null || value === undefined || value === 0) return '0.00';
      
      // If already a string from database, use it directly
      if (typeof value === 'string') {
        // Keep all decimal places as they are
        const [intPart, decPart] = value.split('.');
        if (decPart) {
          return `${intPart}.${decPart}`;
        }
        return `${intPart}.00`;
      }
      
      // Convert number to string with full precision (18 decimal places)
      // This preserves all significant digits
      const numStr = value.toFixed(18);
      const [intPart, decPart] = numStr.split('.');
      // Keep all decimal digits, don't remove trailing zeros
      return `${intPart}.${decPart}`;
    };

    // Calculate sums with full precision
    const directSum = commissions
      .filter((c) => c.type === CommissionType.DIRECT)
      .reduce((sum, c) => {
        const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
        return sum + amount;
      }, 0);
    
    const groupSum = commissions
      .filter((c) => c.type === CommissionType.GROUP)
      .reduce((sum, c) => {
        const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
        return sum + amount;
      }, 0);
    
    const managementSum = commissions
      .filter((c) => c.type === CommissionType.MANAGEMENT)
      .reduce((sum, c) => {
        const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
        return sum + amount;
      }, 0);
    
    const pendingSum = commissions
      .filter((c) => c.status === CommissionStatus.PENDING)
      .reduce((sum, c) => {
        const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
        return sum + amount;
      }, 0);
    
    const paidSum = commissions
      .filter((c) => c.status === CommissionStatus.PAID)
      .reduce((sum, c) => {
        const amount = typeof c.amount === 'string' ? parseFloat(c.amount) : c.amount;
        return sum + amount;
      }, 0);

    const stats = {
      packageType: user.packageType,
      totalPurchaseAmount: formatDecimal(user.totalPurchaseAmount),
      totalCommissionReceived: formatDecimal(user.totalCommissionReceived),
      totalReconsumptionAmount: formatDecimal(user.totalReconsumptionAmount),
      leftBranchTotal: formatDecimal(user.leftBranchTotal),
      rightBranchTotal: formatDecimal(user.rightBranchTotal),
      commissions: {
        direct: formatDecimal(directSum),
        group: formatDecimal(groupSum),
        management: formatDecimal(managementSum),
      },
      pending: formatDecimal(pendingSum),
      paid: formatDecimal(paidSum),
    };

    return stats;
  }

  /**
   * Lấy tất cả commissions (chỉ admin)
   */
  async getAllCommissions(query: {
    status?: CommissionStatus;
    type?: CommissionType;
    userId?: string;
  }): Promise<Commission[]> {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.userId) where.userId = query.userId;

    const commissions = await this.commissionRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(commissions) as Commission[];
  }

  /**
   * Duyệt commission (chuyển từ pending sang paid)
   */
  async approveCommission(commissionId: string, notes?: string): Promise<Commission> {
    const commission = await this.commissionRepository.findOne({
      where: { id: commissionId },
      relations: ['user'],
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    if (commission.status !== CommissionStatus.PENDING) {
      throw new Error(`Commission is already ${commission.status}`);
    }

    // Update commission status to paid
    commission.status = CommissionStatus.PAID;
    if (notes) {
      commission.notes = notes;
    }

    const saved = await this.commissionRepository.save(commission);
    // Format decimal numbers to fix floating-point precision issues
    return formatDecimalsInObject(saved) as Commission;
  }

  /**
   * Duyệt nhiều commissions cùng lúc
   */
  async approveCommissions(commissionIds: string[]): Promise<{ approved: number; failed: number; errors: string[] }> {
    let approved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const commissionId of commissionIds) {
      try {
        await this.approveCommission(commissionId);
        approved++;
      } catch (error: any) {
        failed++;
        errors.push(`${commissionId}: ${error.message}`);
      }
    }

    return { approved, failed, errors };
  }

  /**
   * Lấy chi tiết commission (chỉ admin)
   */
  async getCommissionDetail(commissionId: string): Promise<Commission> {
    const commission = await this.commissionRepository.findOne({
      where: { id: commissionId },
      relations: ['user'],
    });

    if (!commission) {
      throw new Error('Commission not found');
    }

    return commission;
  }

  /**
   * Award milestone reward to a user
   * Creates commission with PENDING status (will be updated to PAID after USDT transfer)
   */
  async awardMilestoneReward(
    userId: string,
    amount: number,
    milestoneId: string,
  ): Promise<Commission> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Create commission record with PENDING status (will be updated to PAID after USDT transfer)
    const commission = this.commissionRepository.create({
      userId,
      orderId: `milestone-${milestoneId}`, // Use milestone ID as order ID
      type: CommissionType.MILESTONE,
      status: CommissionStatus.PENDING, // Will be updated to PAID after successful USDT transfer
      amount,
      orderAmount: 0, // No order for milestone rewards
      notes: `Milestone reward - ID: ${milestoneId}`,
    });

    await this.commissionRepository.save(commission);

    // Update user's total commission
    user.totalCommissionReceived = (user.totalCommissionReceived || 0) + amount;
    await this.userRepository.save(user);

    return commission;
  }
}
