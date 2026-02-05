import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionService } from './commission.service';
import { CommissionType, CommissionStatus } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AffiliateService {
  constructor(
    private readonly commissionService: CommissionService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  async register(registerDto: any) {
    // Đăng ký affiliate được xử lý khi user đăng ký với referral code
    // Không cần logic riêng ở đây
    return { message: 'Affiliate registration handled during user registration' };
  }

  async getStats(userId: string) {
    return this.commissionService.getStats(userId);
  }

  async getCommissions(userId: string, query: any) {
    const type = query.type as CommissionType | undefined;
    const status = query.status as CommissionStatus | undefined;
    return this.commissionService.getCommissions(userId, { type, status });
  }

  async withdraw(withdrawDto: any) {
    // TODO: Implement affiliate withdraw logic
    // Có thể tích hợp với wallet service để rút tiền
    return { message: 'Affiliate withdraw - to be implemented' };
  }

  /**
   * Lấy thống kê affiliate của tất cả users (chỉ admin)
   */
  async getAllStats(): Promise<any[]> {
    const users = await this.userRepository.find({
      select: [
        'id',
        'email',
        'fullName',
        'username',
        'packageType',
        'totalPurchaseAmount',
        'totalCommissionReceived',
        'totalReconsumptionAmount',
        'leftBranchTotal',
        'rightBranchTotal',
        'referralUser',
        'parentId',
        'position',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });

    // Lấy stats cho từng user
    const statsPromises = users.map(async (user) => {
      const stats = await this.commissionService.getStats(user.id);
      return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        referralUser: user.referralUser,
        parentId: user.parentId,
        position: user.position,
        packageType: user.packageType,
        totalPurchaseAmount: user.totalPurchaseAmount,
        totalCommissionReceived: user.totalCommissionReceived,
        totalReconsumptionAmount: user.totalReconsumptionAmount,
        leftBranchTotal: user.leftBranchTotal,
        rightBranchTotal: user.rightBranchTotal,
        ...stats,
        pending: stats.pendingCommission,
        paid: stats.totalCommission,
        createdAt: user.createdAt,
      };
    });

    return Promise.all(statsPromises);
  }

  /**
   * Lấy tất cả commissions (chỉ admin)
   */
  async getAllCommissions(query: any) {
    const type = query.type as CommissionType | undefined;
    const status = query.status as CommissionStatus | undefined;
    const userId = query.userId as string | undefined;
    return this.commissionService.getAllCommissions({ type, status, userId });
  }

  /**
   * Duyệt commission (chỉ admin)
   */
  async approveCommission(commissionId: string, notes?: string) {
    return this.commissionService.approveCommission(commissionId, notes);
  }

  /**
   * Duyệt nhiều commissions (chỉ admin)
   */
  async approveCommissions(commissionIds: string[]) {
    return this.commissionService.approveCommissions(commissionIds);
  }

  /**
   * Lấy chi tiết commission (chỉ admin)
   */
  async getCommissionDetail(commissionId: string) {
    return this.commissionService.getCommissionDetail(commissionId);
  }
}

