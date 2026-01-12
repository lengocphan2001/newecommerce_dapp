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

      // BƯỚC 1: Tính hoa hồng trực tiếp cho người giới thiệu (TẤT CẢ giao dịch, không phụ thuộc nhánh yếu)
      this.logger.log(`Step 1: Calculating direct commission for order ${orderId}`);
      await this.calculateDirectCommission(order, buyer);

      // BƯỚC 2: Tính hoa hồng nhóm (binary tree) - chỉ tính khi ở nhánh yếu
      // QUAN TRỌNG: Tính weakSide TRƯỚC KHI update volume (dựa trên volume cũ)
      // Sau đó mới update volume
      this.logger.log(`Step 2: Calculating group commission for order ${orderId}`);
      await this.calculateGroupCommission(order, buyer);

      // BƯỚC 3: Update volume cho TẤT CẢ ancestors SAU KHI tính commission
      // Volume được update sau để không ảnh hưởng đến việc xác định weakSide
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
   */
  private async updateUserPackage(user: User, orderAmount: number): Promise<void> {
    const newTotalPurchase = user.totalPurchaseAmount + orderAmount;

    let newPackageType: 'NONE' | 'CTV' | 'NPP' = user.packageType;

    const nppConfig = await this.getConfig('NPP');
    if (newTotalPurchase >= nppConfig.PACKAGE_VALUE) {
      newPackageType = 'NPP';
    } else {
      const ctvConfig = await this.getConfig('CTV');
      if (newTotalPurchase >= ctvConfig.PACKAGE_VALUE) {
        newPackageType = 'CTV';
      }
    }

    if (newPackageType !== user.packageType) {
      await this.userRepository.update(user.id, {
        packageType: newPackageType,
        totalPurchaseAmount: newTotalPurchase,
      });
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
    const canReceiveCommission = await this.checkReconsumption(referrer);
    if (!canReceiveCommission) {
      return;
    }

    const config = await this.getConfig(
      referrer.packageType === 'NPP' ? 'NPP' : 'CTV'
    );

    const commissionAmount = order.totalAmount * config.DIRECT_RATE;

    this.logger.log(`Creating direct commission: referrer ${referrer.id}, buyer ${buyer.id}, amount: ${commissionAmount}, orderAmount: ${order.totalAmount}`);

    try {
      const commission = this.commissionRepository.create({
        userId: referrer.id,
        orderId: order.id,
        fromUserId: buyer.id,
        type: CommissionType.DIRECT,
        status: CommissionStatus.PENDING,
        amount: commissionAmount,
        orderAmount: order.totalAmount,
      });

      await this.commissionRepository.save(commission);
      this.logger.log(`Direct commission created successfully: ${commission.id}`);

      // Reload referrer từ DB để có totalCommissionReceived mới nhất trước khi update
      const freshReferrer = await this.userRepository.findOne({
        where: { id: referrer.id },
        select: ['id', 'totalCommissionReceived'],
      });

      if (freshReferrer) {
        // Cập nhật tổng hoa hồng đã nhận (sử dụng fresh data)
        await this.userRepository.update(freshReferrer.id, {
          totalCommissionReceived: freshReferrer.totalCommissionReceived + commissionAmount,
        });
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
      // Reload ancestor từ DB để có volume mới nhất (tránh race condition)
      const freshAncestor = await this.userRepository.findOne({
        where: { id: ancestor.id },
      });
      if (!freshAncestor) {
        this.logger.warn(`Ancestor ${ancestor.id} not found in DB`);
        continue;
      }

      // Xác định buyer thuộc nhánh nào của ancestor
      const buyerSide = await this.getBuyerSide(buyer, freshAncestor);
      const oldVolume = buyerSide === 'left' ? freshAncestor.leftBranchTotal : freshAncestor.rightBranchTotal;
      const newVolume = oldVolume + order.totalAmount;

      this.logger.log(`Updating volume for ancestor ${freshAncestor.id}: ${buyerSide} branch from ${oldVolume} to ${newVolume} (order amount: ${order.totalAmount})`);

      // Update volume cho nhánh tương ứng (TRƯỚC KHI tính commission)
      await this.userRepository.update(freshAncestor.id, {
        [buyerSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']: newVolume,
      });
    }
  }

  /**
   * Tính hoa hồng nhóm (binary tree)
   * Logic:
   * 1. Kiểm tra buyer có ở nhánh yếu của parent trực tiếp không
   * 2. Nếu có → parent trực tiếp nhận team commission
   * 3. Tất cả ancestors nhận team commission (hoa hồng cân cặp) - KHÔNG cần kiểm tra nhánh yếu
   * QUAN TRỌNG: Dựa vào parentId trong binary tree, KHÔNG phải referralUserId
   */
  private async calculateGroupCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      this.logger.debug(`Buyer ${buyer.id} has no parentId, skipping group commission`);
      return;
    }

    // Lấy parent trực tiếp
    const directParent = await this.userRepository.findOne({
      where: { id: buyer.parentId },
    });

    if (!directParent) {
      this.logger.warn(`Direct parent ${buyer.parentId} not found for buyer ${buyer.id}`);
      return;
    }

    // Kiểm tra buyer có ở nhánh yếu của parent trực tiếp không
    const freshParent = await this.userRepository.findOne({
      where: { id: directParent.id },
    });
    if (!freshParent) return;

    const weakSide = await this.getWeakSide(freshParent.id);
    const buyerSide = await this.getBuyerSide(buyer, freshParent);

    this.logger.log(`[GROUP COMMISSION] Direct parent ${freshParent.id}: weakSide=${weakSide}, buyerSide=${buyerSide}, leftVolume=${freshParent.leftBranchTotal}, rightVolume=${freshParent.rightBranchTotal}`);

    // Chỉ tính hoa hồng nếu buyer ở nhánh yếu của parent trực tiếp
    if (buyerSide !== weakSide) {
      this.logger.debug(`Buyer ${buyer.id} is NOT on weak side of direct parent ${freshParent.id}, skipping group commission`);
      return;
    }

    // Buyer ở nhánh yếu của parent trực tiếp → tính team commission cho tất cả ancestors
    this.logger.log(`[GROUP COMMISSION] Buyer ${buyer.id} is on weak side of direct parent ${freshParent.id}, calculating team commission for all ancestors (hoa hồng cân cặp)`);

    // 1. Parent trực tiếp nhận team commission
    if (freshParent.packageType !== 'NONE') {
      const canReceiveCommission = await this.checkReconsumption(freshParent);
      if (canReceiveCommission) {
        await this.createGroupCommission(order, buyer, freshParent, weakSide);
      }
    }

    // 2. Tất cả ancestors nhận team commission (hoa hồng cân cặp) - KHÔNG cần kiểm tra nhánh yếu
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(`[GROUP COMMISSION] Found ${ancestors.length} ancestors for buyer ${buyer.id}, all will receive team commission (hoa hồng cân cặp)`);
    
    if (ancestors.length === 0) {
      this.logger.warn(`[GROUP COMMISSION] No ancestors found for buyer ${buyer.id}, cannot create hoa hồng cân cặp`);
    }

    for (const ancestor of ancestors) {
      this.logger.log(`[GROUP COMMISSION] Processing ancestor ${ancestor.id} (packageType: ${ancestor.packageType}) for hoa hồng cân cặp`);
      
      if (ancestor.packageType === 'NONE') {
        this.logger.debug(`[GROUP COMMISSION] Skipping ancestor ${ancestor.id} - packageType is NONE`);
        continue;
      }

      // Kiểm tra tái tiêu dùng
      const canReceiveCommission = await this.checkReconsumption(ancestor);
      if (!canReceiveCommission) {
        this.logger.warn(`[GROUP COMMISSION] Skipping ancestor ${ancestor.id} - cannot receive commission (reconsumption check failed)`);
        continue;
      }

      // Reload ancestor từ DB
      const freshAncestor = await this.userRepository.findOne({
        where: { id: ancestor.id },
      });
      if (!freshAncestor) {
        this.logger.warn(`[GROUP COMMISSION] Ancestor ${ancestor.id} not found in DB`);
        continue;
      }

      // Xác định buyer thuộc nhánh nào của ancestor (để lưu vào side field)
      const buyerSideForAncestor = await this.getBuyerSide(buyer, freshAncestor);

      // Tất cả ancestors nhận team commission (hoa hồng cân cặp) - KHÔNG cần kiểm tra nhánh yếu
      this.logger.log(`[GROUP COMMISSION] Creating team commission for ancestor ${freshAncestor.id} (hoa hồng cân cặp), buyerSide: ${buyerSideForAncestor}`);
      await this.createGroupCommission(order, buyer, freshAncestor, buyerSideForAncestor);
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
  ): Promise<void> {
    const config = await this.getConfig(
      ancestor.packageType === 'NPP' ? 'NPP' : 'CTV'
    );

    const commissionAmount = order.totalAmount * config.GROUP_RATE;

    this.logger.log(`Creating group commission: ancestor ${ancestor.id}, buyer ${buyer.id}, side: ${side}, amount: ${commissionAmount}`);

    const commission = this.commissionRepository.create({
      userId: ancestor.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.GROUP,
      status: CommissionStatus.PENDING,
      amount: commissionAmount,
      orderAmount: order.totalAmount,
      side: side,
    });

    await this.commissionRepository.save(commission);
    this.logger.log(`Group commission created successfully: ${commission.id}`);

    // Reload ancestor từ DB để có totalCommissionReceived mới nhất trước khi update
    const freshAncestorForUpdate = await this.userRepository.findOne({
      where: { id: ancestor.id },
      select: ['id', 'totalCommissionReceived'],
    });

    if (freshAncestorForUpdate) {
      // Cập nhật tổng hoa hồng đã nhận
      await this.userRepository.update(freshAncestorForUpdate.id, {
        totalCommissionReceived:
          freshAncestorForUpdate.totalCommissionReceived + commissionAmount,
      });
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
   * QUAN TRỌNG: Tính dựa trên team commission mà F1 nhận được, không phải buyer
   * - Tìm parent trực tiếp của buyer (F1)
   * - Nếu F1 nhận team commission → ancestors nhận management commission
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return; // Buyer không có parent trong binary tree
    }

    // Tìm hoa hồng nhóm mà parent trực tiếp (F1) nhận được từ đơn hàng này
    // QUAN TRỌNG: Hoa hồng quản lý được tính dựa trên hoa hồng nhóm mà F1 nhận được
    const f1GroupCommission = await this.commissionRepository.findOne({
      where: {
        userId: buyer.parentId, // F1 (parent trực tiếp)
        orderId: order.id,
        type: CommissionType.GROUP,
      },
    });

    if (!f1GroupCommission) {
      this.logger.debug(`F1 (parent ${buyer.parentId}) did not receive group commission, skipping management commission`);
      return; // F1 không nhận hoa hồng nhóm từ đơn hàng này
    }

    this.logger.log(`[MANAGEMENT COMMISSION] F1 (${buyer.parentId}) received group commission: ${f1GroupCommission.amount}, calculating management commission for ancestors`);

    // Lấy F1 (parent trực tiếp của buyer)
    const f1 = await this.userRepository.findOne({
      where: { id: buyer.parentId },
    });
    if (!f1) {
      this.logger.warn(`F1 (parent ${buyer.parentId}) not found`);
      return;
    }

    // Tìm tất cả ancestors của buyer trong binary tree
    const ancestors = await this.getAncestors(buyer);
    this.logger.log(`[MANAGEMENT COMMISSION] Found ${ancestors.length} ancestors for buyer ${buyer.id}, will check management commission for each`);

    if (ancestors.length === 0) {
      this.logger.warn(`[MANAGEMENT COMMISSION] No ancestors found for buyer ${buyer.id}, cannot calculate management commission`);
    }

    for (const ancestor of ancestors) {
      this.logger.log(`[MANAGEMENT COMMISSION] Processing ancestor ${ancestor.id} (packageType: ${ancestor.packageType})`);
      
      if (ancestor.packageType === 'NONE') {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - packageType is NONE`);
        continue; // Ancestor chưa có gói, không tính hoa hồng quản lý
      }

      // Kiểm tra tái tiêu dùng
      const canReceiveCommission = await this.checkReconsumption(ancestor);
      if (!canReceiveCommission) {
        this.logger.warn(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - cannot receive commission (reconsumption check failed)`);
        continue; // Ancestor chưa đủ điều kiện tái tiêu dùng
      }

      // Xác định F1 là F1/F2/F3 của ancestor như thế nào
      // QUAN TRỌNG: Tính dựa trên F1, không phải buyer
      const level = await this.getGenerationLevel(f1, ancestor);
      this.logger.log(`[MANAGEMENT COMMISSION] F1 (${f1.id}) is F${level} of ancestor ${ancestor.id}`);

      if (level === null || level > 3) {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - F1 is not F1/F2/F3 (level: ${level})`);
        continue; // F1 không phải F1/F2/F3 của ancestor, hoặc vượt quá F3
      }

      // CTV chỉ nhận hoa hồng quản lý từ F1
      if (ancestor.packageType === 'CTV' && level !== 1) {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - CTV only receives from F1, but F1 is F${level}`);
        continue;
      }

      // NPP nhận hoa hồng quản lý từ F1, F2, F3
      if (ancestor.packageType === 'NPP' && level > 3) {
        this.logger.debug(`[MANAGEMENT COMMISSION] Skipping ancestor ${ancestor.id} - NPP only receives from F1/F2/F3, but F1 is F${level}`);
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

      // Tính hoa hồng quản lý dựa trên team commission mà F1 nhận được
      this.logger.log(`[MANAGEMENT COMMISSION] F1 (${f1.id}) is F${level} of ancestor ${freshAncestor.id}, calculating management commission based on F1's group commission: ${f1GroupCommission.amount}`);
      await this.calculateManagementForLevel(
        order,
        f1, // Sử dụng F1 thay vì buyer
        freshAncestor,
        level,
        f1GroupCommission.amount, // Sử dụng F1's group commission amount
      );
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
   */
  private async calculateManagementForLevel(
    order: Order,
    buyer: User,
    manager: User,
    level: number,
    groupCommissionAmount: number,
  ): Promise<void> {
    let rate: number;
    if (manager.packageType === 'CTV') {
      const ctvConfig = await this.getConfig('CTV');
      rate = ctvConfig.MANAGEMENT_RATE; // 15%
    } else if (manager.packageType === 'NPP') {
      const nppConfig = await this.getConfig('NPP');
      const fKey = `F${level}` as 'F1' | 'F2' | 'F3';
      rate = nppConfig.MANAGEMENT_RATES[fKey] || 0;
    } else {
      return;
    }

    // Tính hoa hồng quản lý dựa trên hoa hồng nhóm mà F1/F2/F3 nhận được
    const commissionAmount = groupCommissionAmount * rate;

    const commission = this.commissionRepository.create({
      userId: manager.id,
      orderId: order.id,
      fromUserId: buyer.id,
      type: CommissionType.MANAGEMENT,
      status: CommissionStatus.PENDING,
      amount: commissionAmount,
      orderAmount: order.totalAmount,
      level: level,
    });

    await this.commissionRepository.save(commission);

    // Cập nhật tổng hoa hồng đã nhận
    await this.userRepository.update(manager.id, {
      totalCommissionReceived:
        manager.totalCommissionReceived + commissionAmount,
    });
  }

  /**
   * Kiểm tra điều kiện tái tiêu dùng
   * Trả về true nếu có thể nhận hoa hồng, false nếu cần tái tiêu dùng
   * 
   * Logic:
   * - Nếu chưa đạt ngưỡng hoa hồng → có thể nhận hoa hồng bình thường
   * - Nếu đã đạt ngưỡng → phải kiểm tra tái tiêu dùng
   *   - Đã đủ tái tiêu dùng → có thể nhận hoa hồng
   *   - Chưa đủ tái tiêu dùng → không thể nhận hoa hồng
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

    // Tính tổng commission KHÔNG bao gồm milestone
    // Query từ database để lấy tổng commission (direct + group + management)
    // Chỉ tính PENDING và PAID (không tính BLOCKED vì chưa được nhận)
    const totalCommissionWithoutMilestone = await this.commissionRepository
      .createQueryBuilder('commission')
      .select('COALESCE(SUM(commission.amount), 0)', 'total')
      .where('commission.userId = :userId', { userId: user.id })
      .andWhere('commission.type != :milestoneType', { milestoneType: CommissionType.MILESTONE })
      .andWhere('commission.status IN (:...statuses)', { statuses: [CommissionStatus.PENDING, CommissionStatus.PAID] })
      .getRawOne();

    const commissionTotal = parseFloat(totalCommissionWithoutMilestone?.total || '0') || 0;

    this.logger.debug(`[RECONSUMPTION CHECK] User ${user.id}: totalCommissionReceived=${user.totalCommissionReceived}, commissionWithoutMilestone=${commissionTotal}, threshold=${config.RECONSUMPTION_THRESHOLD}`);

    // Kiểm tra xem đã đạt ngưỡng hoa hồng chưa (chỉ tính commission, không tính milestone)
    if (commissionTotal < config.RECONSUMPTION_THRESHOLD) {
      // Chưa đạt ngưỡng → có thể nhận hoa hồng bình thường (không cần tái tiêu dùng)
      return true;
    }

    // Đã đạt ngưỡng → phải kiểm tra tái tiêu dùng
    // Tính số chu kỳ đã đạt ngưỡng (dựa trên commission không bao gồm milestone)
    const cycles = Math.floor(
      commissionTotal / config.RECONSUMPTION_THRESHOLD,
    );
    // Số tiền tái tiêu dùng cần thiết cho số chu kỳ này
    const requiredReconsumption = cycles * config.RECONSUMPTION_REQUIRED;

    // Kiểm tra xem đã tái tiêu dùng đủ chưa
    const hasEnoughReconsumption = user.totalReconsumptionAmount >= requiredReconsumption;

    this.logger.debug(`[RECONSUMPTION CHECK] User ${user.id}: cycles=${cycles}, requiredReconsumption=${requiredReconsumption}, actualReconsumption=${user.totalReconsumptionAmount}, hasEnough=${hasEnoughReconsumption}`);

    return hasEnoughReconsumption;
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
   * Nếu cả hai nhánh đều = 0, trả về 'left' làm mặc định
   * Reload user từ DB để có volume mới nhất
   */
  private async getWeakSide(userId: string): Promise<'left' | 'right'> {
    // Reload user từ DB để có volume mới nhất (tránh race condition)
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'leftBranchTotal', 'rightBranchTotal'],
    });

    if (!user) {
      return 'left'; // Fallback
    }

    // Nếu cả hai nhánh đều = 0, chọn left làm mặc định
    if (user.leftBranchTotal === 0 && user.rightBranchTotal === 0) {
      return 'left';
    }
    // So sánh tổng doanh số
    if (user.leftBranchTotal <= user.rightBranchTotal) {
      return 'left';
    }
    return 'right';
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
    const where: any = { userId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;

    return this.commissionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
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

    return this.commissionRepository.find({
      where,
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
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

    return this.commissionRepository.save(commission);
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
