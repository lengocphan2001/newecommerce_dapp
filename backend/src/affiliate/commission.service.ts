import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import {
  Commission,
  CommissionType,
  CommissionStatus,
} from './entities/commission.entity';

// Cấu hình hoa hồng
const COMMISSION_CONFIG = {
  CTV: {
    DIRECT_RATE: 0.2, // 20%
    GROUP_RATE: 0.1, // 10%
    MANAGEMENT_RATE: 0.15, // 15% trên hoa hồng nhóm của F1
    PACKAGE_VALUE: 0.0001, // Giá trị gói CTV - điều kiện để trở thành CTV (TEST: giảm từ 40)
    RECONSUMPTION_THRESHOLD: 0.001, // Ngưỡng hoa hồng để yêu cầu tái tiêu dùng: khi nhận được $0.001 hoa hồng (TEST: giảm từ 160)
    RECONSUMPTION_REQUIRED: 0.0001, // Số tiền tái tiêu dùng cần thiết: $0.0001 mỗi chu kỳ (TEST: giảm từ 40)
  },
  NPP: {
    DIRECT_RATE: 0.25, // 25%
    GROUP_RATE: 0.15, // 15%
    MANAGEMENT_RATES: {
      F1: 0.15, // 15% trên hoa hồng nhóm F1
      F2: 0.1, // 10% trên hoa hồng nhóm F2
      F3: 0.1, // 10% trên hoa hồng nhóm F3
    },
    PACKAGE_VALUE: 0.001, // Giá trị gói NPP - điều kiện để trở thành NPP (TEST: giảm từ 400)
    RECONSUMPTION_THRESHOLD: 0.01, // Ngưỡng hoa hồng để yêu cầu tái tiêu dùng: khi nhận được $0.01 hoa hồng (TEST: giảm từ 1600)
    RECONSUMPTION_REQUIRED: 0.001, // Số tiền tái tiêu dùng cần thiết: $0.001 mỗi chu kỳ (TEST: giảm từ 400)
  },
};

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    private dataSource: DataSource,
  ) {}

  /**
   * Tính toán và phân phối hoa hồng khi có đơn hàng mới
   */
  async calculateCommissions(orderId: string): Promise<void> {
    // Kiểm tra xem đã tính commission cho order này chưa (tránh duplicate)
    const existingCommissions = await this.commissionRepository.find({
      where: { orderId },
    });
    
    if (existingCommissions.length > 0) {
      return;
    }
    
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      return;
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      return;
    }

    const buyer = await this.userRepository.findOne({
      where: { id: order.userId },
    });

    if (!buyer) {
      return;
    }

    try {
      // Cập nhật package type nếu cần
      await this.updateUserPackage(buyer, order.totalAmount);
      
      // Reload buyer để có package type mới nhất
      const updatedBuyer = await this.userRepository.findOne({
        where: { id: buyer.id },
      });
      if (updatedBuyer && updatedBuyer.packageType !== buyer.packageType) {
        Object.assign(buyer, updatedBuyer);
      }

      // Tính hoa hồng trực tiếp cho người giới thiệu (TẤT CẢ giao dịch, không phụ thuộc nhánh yếu)
      await this.calculateDirectCommission(order, buyer);

      // Tính hoa hồng nhóm (binary tree) - chỉ tính khi ở nhánh yếu
      await this.calculateGroupCommission(order, buyer);

      // Tính hoa hồng quản lý nhóm
      await this.calculateManagementCommission(order, buyer);
    } catch (error: any) {
      // Không throw để không block order update
    }
  }

  /**
   * Cập nhật package type của user dựa trên tổng giá trị mua
   */
  private async updateUserPackage(user: User, orderAmount: number): Promise<void> {
    const newTotalPurchase = user.totalPurchaseAmount + orderAmount;

    let newPackageType: 'NONE' | 'CTV' | 'NPP' = user.packageType;

    if (newTotalPurchase >= COMMISSION_CONFIG.NPP.PACKAGE_VALUE) {
      newPackageType = 'NPP';
    } else if (newTotalPurchase >= COMMISSION_CONFIG.CTV.PACKAGE_VALUE) {
      newPackageType = 'CTV';
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
    // Kiểm tra có người giới thiệu ban đầu không
    // Sử dụng referralUserId thay vì parentId để tính hoa hồng trực tiếp
    if (!buyer.referralUserId) {
      return; // Không có người giới thiệu ban đầu
    }

    const referrer = await this.userRepository.findOne({
      where: { id: buyer.referralUserId },
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

    const config =
      referrer.packageType === 'NPP'
        ? COMMISSION_CONFIG.NPP
        : COMMISSION_CONFIG.CTV;

    const commissionAmount = order.totalAmount * config.DIRECT_RATE;

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

      // Cập nhật tổng hoa hồng đã nhận
      await this.userRepository.update(referrer.id, {
        totalCommissionReceived: referrer.totalCommissionReceived + commissionAmount,
      });
    } catch (error: any) {
      throw error; // Re-throw để có thể xử lý ở trên
    }
  }

  /**
   * Tính hoa hồng nhóm (binary tree)
   * Nhận hoa hồng khi phát sinh giao dịch tại nhánh yếu
   */
  private async calculateGroupCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return;
    }

    // Tìm tất cả ancestors trong cây nhị phân
    const ancestors = await this.getAncestors(buyer);

    for (const ancestor of ancestors) {
      if (ancestor.packageType === 'NONE') {
        continue;
      }

      // Kiểm tra tái tiêu dùng
      const canReceiveCommission = await this.checkReconsumption(ancestor);
      if (!canReceiveCommission) {
        continue;
      }

      // Xác định nhánh yếu
      const weakSide = this.getWeakSide(ancestor);
      const buyerSide = await this.getBuyerSide(buyer, ancestor);

      // Chỉ tính hoa hồng nếu giao dịch ở nhánh yếu
      if (buyerSide === weakSide) {
        const config =
          ancestor.packageType === 'NPP'
            ? COMMISSION_CONFIG.NPP
            : COMMISSION_CONFIG.CTV;

        const commissionAmount = order.totalAmount * config.GROUP_RATE;

        const commission = this.commissionRepository.create({
          userId: ancestor.id,
          orderId: order.id,
          fromUserId: buyer.id,
          type: CommissionType.GROUP,
          status: CommissionStatus.PENDING,
          amount: commissionAmount,
          orderAmount: order.totalAmount,
          side: weakSide,
        });

        await this.commissionRepository.save(commission);

        // Cập nhật tổng hoa hồng và tổng doanh số nhánh
        await this.userRepository.update(ancestor.id, {
          totalCommissionReceived:
            ancestor.totalCommissionReceived + commissionAmount,
          [weakSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']:
            (weakSide === 'left'
              ? ancestor.leftBranchTotal
              : ancestor.rightBranchTotal) + order.totalAmount,
        });
      } else {
        // Cập nhật tổng doanh số nhánh mạnh (không tính hoa hồng)
        const strongSide = weakSide === 'left' ? 'right' : 'left';
        await this.userRepository.update(ancestor.id, {
          [strongSide === 'left' ? 'leftBranchTotal' : 'rightBranchTotal']:
            (strongSide === 'left'
              ? ancestor.leftBranchTotal
              : ancestor.rightBranchTotal) + order.totalAmount,
        });
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
   * Khi buyer nhận hoa hồng nhóm:
   * - Tìm tất cả ancestors của buyer trong binary tree
   * - Với mỗi ancestor, xác định buyer là F1/F2/F3 của ancestor
   * - Nếu buyer là F1/F2/F3 của ancestor và buyer nhận hoa hồng nhóm → ancestor nhận hoa hồng quản lý
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return; // Buyer không có parent trong binary tree
    }

    // Tìm hoa hồng nhóm mà buyer nhận được từ đơn hàng này
    const buyerGroupCommission = await this.commissionRepository.findOne({
      where: {
        userId: buyer.id,
        orderId: order.id,
        type: CommissionType.GROUP,
      },
    });

    if (!buyerGroupCommission) {
      return; // Buyer không nhận hoa hồng nhóm từ đơn hàng này
    }

    // Tìm tất cả ancestors của buyer trong binary tree
    const ancestors = await this.getAncestors(buyer);

    for (const ancestor of ancestors) {
      if (ancestor.packageType === 'NONE') {
        continue; // Ancestor chưa có gói, không tính hoa hồng quản lý
      }

      // Kiểm tra tái tiêu dùng
      const canReceiveCommission = await this.checkReconsumption(ancestor);
      if (!canReceiveCommission) {
        continue; // Ancestor chưa đủ điều kiện tái tiêu dùng
      }

      // Xác định buyer là F1/F2/F3 của ancestor như thế nào
      const level = await this.getGenerationLevel(buyer, ancestor);

      if (level === null || level > 3) {
        continue; // Buyer không phải F1/F2/F3 của ancestor, hoặc vượt quá F3
      }

      // CTV chỉ nhận hoa hồng quản lý từ F1
      if (ancestor.packageType === 'CTV' && level !== 1) {
        continue;
      }

      // NPP nhận hoa hồng quản lý từ F1, F2, F3
      if (ancestor.packageType === 'NPP' && level > 3) {
        continue;
      }

      // Tính hoa hồng quản lý
      await this.calculateManagementForLevel(
        order,
        buyer,
        ancestor,
        level,
        buyerGroupCommission.amount,
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
      rate = COMMISSION_CONFIG.CTV.MANAGEMENT_RATE; // 15%
    } else if (manager.packageType === 'NPP') {
      rate = COMMISSION_CONFIG.NPP.MANAGEMENT_RATES[`F${level}` as 'F1' | 'F2' | 'F3'];
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
   */
  private async checkReconsumption(user: User): Promise<boolean> {
    if (user.packageType === 'NONE') {
      return false;
    }

    const config =
      user.packageType === 'NPP'
        ? COMMISSION_CONFIG.NPP
        : COMMISSION_CONFIG.CTV;

    // Kiểm tra xem đã đạt ngưỡng hoa hồng chưa
    // Ngưỡng: CTV = $0.0001, NPP = $0.001
    if (user.totalCommissionReceived < config.RECONSUMPTION_THRESHOLD) {
      // Chưa đạt ngưỡng → có thể nhận hoa hồng bình thường (không cần tái tiêu dùng)
      return true;
    }

    // Đã đạt ngưỡng → phải kiểm tra tái tiêu dùng
    // Tính số chu kỳ đã đạt ngưỡng
    const cycles = Math.floor(
      user.totalCommissionReceived / config.RECONSUMPTION_THRESHOLD,
    );
    // Số tiền tái tiêu dùng cần thiết cho số chu kỳ này
    // CTV: $0.001 mỗi chu kỳ, NPP: $0.01 mỗi chu kỳ
    const requiredReconsumption = cycles * config.RECONSUMPTION_REQUIRED;

    // Kiểm tra xem đã tái tiêu dùng đủ chưa
    const hasEnoughReconsumption = user.totalReconsumptionAmount >= requiredReconsumption;

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
   */
  private getWeakSide(user: User): 'left' | 'right' {
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
    let current = buyer;

    while (current.parentId && current.parentId !== ancestor.id) {
      const parent = await this.userRepository.findOne({
        where: { id: current.parentId },
      });
      if (!parent) break;
      current = parent;
    }

    return current.position || 'left';
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
}
