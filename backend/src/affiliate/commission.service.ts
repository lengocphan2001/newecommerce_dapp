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
    PACKAGE_VALUE: 40, // Giá trị gói CTV
    RECONSUMPTION_THRESHOLD: 160, // Ngưỡng hoa hồng để yêu cầu tái tiêu dùng
    RECONSUMPTION_REQUIRED: 40, // Số tiền tái tiêu dùng cần thiết
  },
  NPP: {
    DIRECT_RATE: 0.25, // 25%
    GROUP_RATE: 0.15, // 15%
    MANAGEMENT_RATES: {
      F1: 0.15, // 15% trên hoa hồng nhóm F1
      F2: 0.1, // 10% trên hoa hồng nhóm F2
      F3: 0.1, // 10% trên hoa hồng nhóm F3
    },
    PACKAGE_VALUE: 400, // Giá trị gói NPP
    RECONSUMPTION_THRESHOLD: 1600, // Ngưỡng hoa hồng để yêu cầu tái tiêu dùng
    RECONSUMPTION_REQUIRED: 400, // Số tiền tái tiêu dùng cần thiết
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
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order || order.status !== OrderStatus.CONFIRMED) {
      return;
    }

    const buyer = await this.userRepository.findOne({
      where: { id: order.userId },
    });

    if (!buyer) {
      return;
    }

    // Cập nhật package type nếu cần
    await this.updateUserPackage(buyer, order.totalAmount);

    // Tính hoa hồng trực tiếp cho người giới thiệu
    await this.calculateDirectCommission(order, buyer);

    // Tính hoa hồng nhóm (binary tree)
    await this.calculateGroupCommission(order, buyer);

    // Tính hoa hồng quản lý nhóm
    await this.calculateManagementCommission(order, buyer);
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
   */
  private async calculateDirectCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return; // Không có người giới thiệu
    }

    const referrer = await this.userRepository.findOne({
      where: { id: buyer.parentId },
    });

    if (!referrer || referrer.packageType === 'NONE') {
      return; // Người giới thiệu chưa có gói
    }

    // Kiểm tra tái tiêu dùng
    const canReceiveCommission = await this.checkReconsumption(referrer);
    if (!canReceiveCommission) {
      return;
    }

    const config =
      referrer.packageType === 'NPP'
        ? COMMISSION_CONFIG.NPP
        : COMMISSION_CONFIG.CTV;

    const commissionAmount = order.totalAmount * config.DIRECT_RATE;

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
   * CTV: 15% trên hoa hồng nhóm F1
   * NPP: 15% F1, 10% F2, 10% F3
   */
  private async calculateManagementCommission(
    order: Order,
    buyer: User,
  ): Promise<void> {
    if (!buyer.parentId) {
      return;
    }

    // Tìm F1 của buyer (người giới thiệu trực tiếp)
    const f1 = await this.userRepository.findOne({
      where: { id: buyer.parentId },
    });

    if (!f1 || f1.packageType === 'NONE') {
      return;
    }

    // Tìm hoa hồng nhóm mà F1 nhận được từ đơn hàng này
    const f1GroupCommission = await this.commissionRepository.findOne({
      where: {
        userId: f1.id,
        orderId: order.id,
        type: CommissionType.GROUP,
      },
    });

    if (!f1GroupCommission) {
      return; // F1 không nhận hoa hồng nhóm từ đơn hàng này
    }

    // Tính hoa hồng quản lý cho F1 (nếu là CTV hoặc NPP)
    if (f1.packageType === 'CTV' || f1.packageType === 'NPP') {
      await this.calculateManagementForLevel(order, buyer, f1, 1, f1GroupCommission.amount);
    }

    // Nếu F1 là NPP, tính tiếp F2 và F3
    if (f1.packageType === 'NPP' && f1.parentId) {
      const f2 = await this.userRepository.findOne({ where: { id: f1.parentId } });

      if (f2 && f2.packageType === 'NPP') {
        // Tìm hoa hồng nhóm mà F2 nhận được
        const f2GroupCommission = await this.commissionRepository.findOne({
          where: {
            userId: f2.id,
            orderId: order.id,
            type: CommissionType.GROUP,
          },
        });

        if (f2GroupCommission) {
          await this.calculateManagementForLevel(order, buyer, f2, 2, f2GroupCommission.amount);
        }

        // Tính F3
        if (f2.parentId) {
          const f3 = await this.userRepository.findOne({ where: { id: f2.parentId } });

          if (f3 && f3.packageType === 'NPP') {
            // Tìm hoa hồng nhóm mà F3 nhận được
            const f3GroupCommission = await this.commissionRepository.findOne({
              where: {
                userId: f3.id,
                orderId: order.id,
                type: CommissionType.GROUP,
              },
            });

            if (f3GroupCommission) {
              await this.calculateManagementForLevel(order, buyer, f3, 3, f3GroupCommission.amount);
            }
          }
        }
      }
    }
  }

  /**
   * Tính hoa hồng quản lý cho một cấp độ cụ thể
   */
  private async calculateManagementForLevel(
    order: Order,
    buyer: User,
    manager: User,
    level: number,
    groupCommissionAmount: number,
  ): Promise<void> {
    // Kiểm tra tái tiêu dùng
    const canReceiveCommission = await this.checkReconsumption(manager);
    if (!canReceiveCommission) {
      return;
    }

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
    if (user.totalCommissionReceived < config.RECONSUMPTION_THRESHOLD) {
      return true; // Chưa đạt ngưỡng, có thể nhận hoa hồng bình thường
    }

    // Đã đạt ngưỡng, kiểm tra tái tiêu dùng
    // Tính số lần đã đạt ngưỡng
    const cycles = Math.floor(
      user.totalCommissionReceived / config.RECONSUMPTION_THRESHOLD,
    );
    const requiredReconsumption = cycles * config.RECONSUMPTION_REQUIRED;

    return user.totalReconsumptionAmount >= requiredReconsumption;
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
   */
  private getWeakSide(user: User): 'left' | 'right' {
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

    const stats = {
      packageType: user.packageType,
      totalPurchaseAmount: user.totalPurchaseAmount,
      totalCommissionReceived: user.totalCommissionReceived,
      totalReconsumptionAmount: user.totalReconsumptionAmount,
      leftBranchTotal: user.leftBranchTotal,
      rightBranchTotal: user.rightBranchTotal,
      commissions: {
        direct: commissions
          .filter((c) => c.type === CommissionType.DIRECT)
          .reduce((sum, c) => sum + c.amount, 0),
        group: commissions
          .filter((c) => c.type === CommissionType.GROUP)
          .reduce((sum, c) => sum + c.amount, 0),
        management: commissions
          .filter((c) => c.type === CommissionType.MANAGEMENT)
          .reduce((sum, c) => sum + c.amount, 0),
      },
      pending: commissions
        .filter((c) => c.status === CommissionStatus.PENDING)
        .reduce((sum, c) => sum + c.amount, 0),
      paid: commissions
        .filter((c) => c.status === CommissionStatus.PAID)
        .reduce((sum, c) => sum + c.amount, 0),
    };

    return stats;
  }
}
