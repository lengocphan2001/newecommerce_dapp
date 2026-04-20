import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HeapRewardPlacement } from './entities/heap-reward-placement.entity';
import { HeapRewardHistory } from './entities/heap-reward-history.entity';
import { User } from '../user/entities/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';

@Injectable()
export class HeapRewardService {
  private readonly logger = new Logger(HeapRewardService.name);

  constructor(
    @InjectRepository(HeapRewardPlacement)
    private placementRepo: Repository<HeapRewardPlacement>,
    @InjectRepository(HeapRewardHistory)
    private historyRepo: Repository<HeapRewardHistory>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
  ) {}

  private async getConfigValue(key: string, defaultValue: number): Promise<number> {
    const config = await this.configRepo.findOne({ where: { key } });
    if (config && config.value) {
      const parsed = parseFloat(config.value);
      if (!isNaN(parsed)) return parsed;
    }
    return defaultValue;
  }

  /**
   * Hook này được gọi khi một Order được duyệt (CONFIRMED) từ OrderService
   */
  async processOrderIfEligible(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order || !order.userId) return;

      const qualifyAmount = await this.getConfigValue('HEAP_QUALIFY_ORDER_AMOUNT', 500);
      const orderTotal = Number(order.totalAmount) || 0;

      if (orderTotal < qualifyAmount) {
        return; // Đơn hàng không đủ điều kiện
      }

      // Lấy user
      const user = await this.userRepo.findOne({ where: { id: order.userId } });
      if (!user) return;

      // Đếm tổng số vị trí đã từng mở của user (bao gồm cả đang active và đã out)
      const currentEntryCount = await this.placementRepo.count({
        where: { userId: user.id },
      });

      const timesEntered = currentEntryCount;

      if (timesEntered === 0) {
        // Lần đầu vào Heap, tự động được vào
        await this.createNewPlacement(user.id, 0, order.id);
        this.logger.log(`User ${user.id} joins Heap (first time).`);
        
        // Chia thưởng ngay lập tức 5% của đơn hàng này
        await this.distributeInstantPayout(orderTotal);
        return;
      }

      // Lần n (>0), cần kiểm tra F1
      // Check tổng số F1 có ít nhất 1 đơn hàng >= qualifyAmount
      const f1Count = await this.countQualifiedF1s(user.id, qualifyAmount);

      if (f1Count >= timesEntered) {
        await this.createNewPlacement(user.id, timesEntered, order.id);
        this.logger.log(`User ${user.id} joins Heap (timesEntered: ${timesEntered}). Qualified F1s: ${f1Count}`);
        
        // Chia thưởng ngay lập tức 5% của đơn hàng này
        await this.distributeInstantPayout(orderTotal);
      } else {
        this.logger.log(`User ${user.id} cannot join Heap. Needs ${timesEntered} qualified F1s, has ${f1Count}.`);
      }
    } catch (e) {
      this.logger.error(`Error processing heap eligibility for order ${orderId}`, e);
    }
  }

  private async countQualifiedF1s(userId: string, qualifyAmount: number): Promise<number> {
    const f1Users = await this.userRepo.find({
      where: { referralUserId: userId },
      select: ['id'],
    });

    if (f1Users.length === 0) return 0;

    const f1Ids = f1Users.map(u => u.id);

    // Truy vấn đếm số distinct userId trong f1Ids có ít nhất 1 order >= qualifyAmount
    const builder = this.orderRepo.createQueryBuilder('order');
    builder.select('COUNT(DISTINCT order.userId)', 'count');
    builder.where('order.userId IN (:...f1Ids)', { f1Ids });
    builder.andWhere('order.status IN (:...statuses)', { statuses: [OrderStatus.CONFIRMED, OrderStatus.DELIVERED] });
    builder.andWhere('order.totalAmount >= :amount', { amount: qualifyAmount });

    const result = await builder.getRawOne();
    return Number(result?.count || 0);
  }

  private async createNewPlacement(userId: string, currentTimesEntered: number, triggerOrderId: string) {
    const placement = this.placementRepo.create({
      userId,
      totalRewarded: 0,
      timesEntered: currentTimesEntered,
      isActive: true,
      triggerOrderId,
    });
    await this.placementRepo.save(placement);
  }

  /**
   * Tính và chia phần trăm ngay lập tức khi có người VÀO Heap
   */
  async distributeInstantPayout(orderTotal: number) {
    this.logger.log(`Starting instant Heap Reward payout for order total: ${orderTotal}`);
    try {
      const rewardPercent = await this.getConfigValue('HEAP_DAILY_REWARD_PERCENT', 5);
      const maxPayout = await this.getConfigValue('HEAP_MAX_PAYOUT', 1000);

      const poolAmount = orderTotal * (rewardPercent / 100);
      this.logger.log(`Pool Amount to distribute: ${poolAmount}`);

      const activePlacements = await this.placementRepo.find({
        where: { isActive: true },
        relations: ['user']
      });

      if (activePlacements.length === 0) {
        this.logger.log('No active users in Heap. Pool carried over or skipped.');
        return;
      }

      const rewardPerUser = poolAmount / activePlacements.length;
      this.logger.log(`Active Heap users: ${activePlacements.length}. Payout per user: ${rewardPerUser}`);

      // Transaction updates
      await this.placementRepo.manager.transaction(async (manager) => {
        const hPlacementRepo = manager.getRepository(HeapRewardPlacement);
        const hHistoryRepo = manager.getRepository(HeapRewardHistory);
        const hUserRepo = manager.getRepository(User);

        for (const placement of activePlacements) {
          const user = placement.user;
          if (!user) continue;

          // Tiền đã nhận từ trước + tiền chia cho hôm nay
          let newTotal = Number(placement.totalRewarded) + rewardPerUser;
          let actualReward = rewardPerUser;
          let isPushOut = false;

          if (newTotal >= maxPayout) {
             actualReward = maxPayout - Number(placement.totalRewarded);
             newTotal = maxPayout;
             isPushOut = true;
          }

          if (actualReward > 0) {
            // Cập nhật Wallet User (withdrawWalletBalance - ví có thể rút)
            await hUserRepo.increment({ id: user.id }, 'withdrawWalletBalance', actualReward);

            // Ghi lịch sử
            const history = hHistoryRepo.create({
              userId: user.id,
              placementId: placement.id,
              amount: actualReward,
              rewardDate: new Date()
            });
            await hHistoryRepo.save(history);

            // Cập nhật placement
            placement.totalRewarded = newTotal;
            if (isPushOut) {
               placement.isActive = false;
               placement.timesEntered = Number(placement.timesEntered) + 1;
               this.logger.log(`User ${user.id} reached Max Payout. Pushed out of Heap.`);
            }

            await hPlacementRepo.save(placement);
          }
        }
      });
      
      this.logger.log('Instant Heap Reward calculation completed.');
    } catch (e) {
      this.logger.error('Instant Heap Reward failed.', e);
    }
  }

  // Admin APIs
  async getPlacements(query: any) {
    const builder = this.placementRepo.createQueryBuilder('p')
       .leftJoinAndSelect('p.user', 'user')
       .leftJoinAndSelect('p.triggerOrder', 'triggerOrder')
       .orderBy('p.createdAt', 'DESC');

    if (query.userId) {
       builder.andWhere('p.userId = :userId', { userId: query.userId });
    }
    if (query.isActive !== undefined) {
      const isActiveBool = query.isActive === 'true' || query.isActive === true;
       builder.andWhere('p.isActive = :isActive', { isActive: isActiveBool });
    }

    const rawLimit = Number(query.limit);
    if (!isNaN(rawLimit) && rawLimit > 0) {
       builder.take(Math.min(rawLimit, 100));
    }

    return builder.getMany();
  }

  async deletePlacement(id: string) {
    return this.placementRepo.delete(id);
  }

  async getHistories(query: any) {
    const builder = this.historyRepo.createQueryBuilder('h')
       .leftJoinAndSelect('h.user', 'user')
       .orderBy('h.createdAt', 'DESC');

    if (query.userId) {
       builder.andWhere('h.userId = :userId', { userId: query.userId });
    }
    if (query.placementId) {
       builder.andWhere('h.placementId = :placementId', { placementId: query.placementId });
    }

    const rawLimit = Number(query.limit);
    if (!isNaN(rawLimit) && rawLimit > 0) {
       builder.take(Math.min(rawLimit, 100));
    }

    return builder.getMany();
  }
}
