import { Injectable, Inject, forwardRef, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionService } from './commission.service';
import { CommissionPayoutService } from './commission-payout.service';
import { CommissionType, CommissionStatus } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';

export interface ApproveCommissionContext {
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AffiliateService {
  constructor(
    private readonly commissionService: CommissionService,
    @Inject(forwardRef(() => CommissionPayoutService))
    private readonly commissionPayoutService: CommissionPayoutService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async register(registerDto: any) {
    // Đăng ký affiliate được xử lý khi user đăng ký với referral code
    // Không cần logic riêng ở đây
    return {
      message: 'Affiliate registration handled during user registration',
    };
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
   * Lấy thống kê affiliate của tất cả users (chỉ admin).
   * Dùng 1 query tổng hợp commission (GROUP BY userId) thay vì N query → nhanh hơn khi nhiều user.
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

    const userIds = users.map((u) => u.id);
    const statsMap = await this.commissionService.getStatsForUserIds(userIds);

    return users.map((user) => {
      const stats = statsMap.get(user.id) ?? {
        totalCommission: 0,
        pendingCommission: 0,
        commissions: { direct: 0, group: 0, management: 0 },
      };
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
        pendingCommission: stats.pendingCommission,
        commissions: stats.commissions,
        pending: stats.pendingCommission,
        paid: stats.totalCommission,
        createdAt: user.createdAt,
      };
    });
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
   * Duyệt commission (chỉ admin) = thực hiện payout on-chain rồi mới đánh dấu PAID.
   * Trả về batchId, txHash để admin xem trên BSCScan.
   */
  async approveCommission(
    commissionId: string,
    notes?: string,
    ctx?: ApproveCommissionContext,
  ) {
    const result = await this.commissionPayoutService.payoutCommissionsByIds(
      [commissionId],
      ctx?.userId,
      ctx?.username,
      ctx?.ipAddress,
      ctx?.userAgent,
    );
    return {
      ...result,
      message: 'Commission approved and paid on-chain successfully',
    };
  }

  /**
   * Duyệt nhiều commissions (chỉ admin) = payout on-chain cho các commission đã chọn.
   */
  async approveCommissions(
    commissionIds: string[],
    ctx?: ApproveCommissionContext,
  ) {
    const result = await this.commissionPayoutService.payoutCommissionsByIds(
      commissionIds,
      ctx?.userId,
      ctx?.username,
      ctx?.ipAddress,
      ctx?.userAgent,
    );
    return {
      approved: result.count,
      failed: commissionIds.length - result.count,
      batchId: result.batchId,
      txHash: result.txHash,
      message:
        result.count > 0
          ? `${result.count} commission(s) paid on-chain successfully`
          : 'No commissions could be paid',
    };
  }

  /**
   * Lấy chi tiết commission (chỉ admin)
   */
  async getCommissionDetail(commissionId: string) {
    return this.commissionService.getCommissionDetail(commissionId);
  }

  async cancelCommission(commissionId: string, reason?: string) {
    return this.commissionService.cancelCommission(commissionId, reason);
  }

  async cancelCommissions(commissionIds: string[], reason?: string) {
    return this.commissionService.cancelCommissions(commissionIds, reason);
  }

  async compensateMissedDirectCommissions(fromDate?: string) {
    return this.commissionService.compensateMissedDirectCommissions(fromDate);
  }

  async compensateSingleOrderCommission(orderId: string) {
    return this.commissionService.compensateSingleOrderCommission(orderId);
  }

  async calculateMonthlyRewards(month: string, performPayout: boolean) {
    return this.commissionService.calculateMonthlyRewards(month, performPayout);
  }

  async getMonthlyStats(month: string) {
    return this.commissionService.getMonthlyStats(month);
  }

  async validateDownline(sponsorId: string, targetUsername: string): Promise<any> {
    if (!targetUsername?.trim()) {
      throw new BadRequestException('Username is required');
    }

    const targetUser = await this.userRepository.findOne({
      where: { username: targetUsername.trim() },
      select: ['id', 'username', 'fullName', 'referralUserId'],
    });

    if (!targetUser) {
      throw new NotFoundException('Username not found');
    }

    if (targetUser.id === sponsorId) {
      throw new BadRequestException('Cannot purchase for yourself');
    }

    // Check if targetUser is a downline of sponsorId
    let currentId = targetUser.id;
    const visited = new Set<string>();
    let isDownline = false;

    while (currentId) {
      if (currentId === sponsorId) {
        isDownline = true;
        break;
      }
      if (visited.has(currentId)) break; // Prevent infinite loop
      visited.add(currentId);

      const u = await this.userRepository.findOne({
        where: { id: currentId },
        select: ['id', 'referralUserId'],
      });
      if (!u || !u.referralUserId) break;
      currentId = u.referralUserId;
    }

    if (!isDownline) {
      throw new BadRequestException('User is not in your downline organization');
    }

    return {
      valid: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        fullName: targetUser.fullName,
      },
    };
  }
}
