import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HeapRewardPlacement } from './entities/heap-reward-placement.entity';
import { HeapRewardHistory } from './entities/heap-reward-history.entity';
import { User } from '../user/entities/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { Product } from '../product/entities/product.entity';
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
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
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
  async processOrderIfEligible(orderId: string, skipWalletUpdate?: boolean): Promise<void> {
    try {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order || !order.userId) return;

      const user = await this.userRepo.findOne({ where: { id: order.userId } });
      if (!user) return;

      const orderTotal = Number(order.totalAmount) || 0;

      // Phân loại mốc PV cho Heap Reward (chỉ gồm 3 bể đồng chia: 100$, 500$, 2400$)
      let poolLevel = 0;
      if (orderTotal >= 2400) {
        poolLevel = 2400;
      } else if (orderTotal >= 500) {
        poolLevel = 500;
      } else if (orderTotal >= 100) {
        poolLevel = 100;
      }

      if (poolLevel === 0) {
        this.logger.log(`[HEAP] Order ${orderId} total ${orderTotal} PV does not qualify for any pool (min 100 PV).`);
        return;
      }

      // Xử lý nhảy cây đồng chia (Heap Reward)
      const poolsToJoin: number[] = [];
      if (poolLevel === 2400) {
        poolsToJoin.push(100, 500, 2400);
      } else if (poolLevel === 500) {
        poolsToJoin.push(500);
      } else if (poolLevel === 100) {
        poolsToJoin.push(100);
      }

      // 1. Chia thưởng cho danh sách thành viên hiện đang ở trong bể TRƯỚC khi người mới vào bể
      // Đồng thời loại trừ người mua ra khỏi danh sách được chia từ chính đơn hàng này (truyền order.userId)
      for (const p of poolsToJoin) {
        const rewardPercent = await this.getConfigValue(`HEAP_POOL_PERCENT_${p}`, p === 100 ? 5 : 10);
        const poolAmount = orderTotal * (rewardPercent / 100);
        await this.distributeInstantPayoutForPool(p, poolAmount, poolLevel, order.userId, skipWalletUpdate);
      }

      // 2. Xếp người mua mới vào các bể (Họ sẽ được nhận thưởng từ các đơn hàng tiếp theo sau này)
      for (const p of poolsToJoin) {
        const timesEntered = await this.placementRepo.count({
          where: { userId: user.id, poolLevel: p },
        });

        if (timesEntered === 0) {
          await this.createNewPlacement(user.id, p, 0, order.id);
          this.logger.log(`User ${user.id} joins Heap pool ${p} (first time).`);
        } else {
          // Lần n (>0), cần kiểm tra F1 đạt ngưỡng tương ứng với bể p
          const f1Count = await this.countQualifiedF1s(user.id, p);
          if (f1Count >= timesEntered) {
            await this.createNewPlacement(user.id, p, timesEntered, order.id);
            this.logger.log(`User ${user.id} joins Heap pool ${p} (timesEntered: ${timesEntered}). Qualified F1s: ${f1Count}`);
          } else {
            this.logger.log(`User ${user.id} cannot join Heap pool ${p}. Needs ${timesEntered} qualified F1s at >= ${p} PV, has ${f1Count}.`);
          }
        }
      }



    } catch (e) {
      this.logger.error(`Error processing heap/promising eligibility for order ${orderId}`, e);
    }
  }

  private async countQualifiedF1s(userId: string, qualifyAmount: number): Promise<number> {
    const f1Users = await this.userRepo.find({
      where: { referralUserId: userId },
      select: ['id'],
    });

    if (f1Users.length === 0) return 0;

    const f1Ids = f1Users.map(u => u.id);

    const builder = this.orderRepo.createQueryBuilder('order');
    builder.select('COUNT(DISTINCT order.userId)', 'count');
    builder.where('order.userId IN (:...f1Ids)', { f1Ids });
    builder.andWhere('order.status IN (:...statuses)', { statuses: [OrderStatus.CONFIRMED, OrderStatus.DELIVERED] });
    builder.andWhere('order.totalAmount >= :amount', { amount: qualifyAmount });

    const result = await builder.getRawOne();
    return Number(result?.count || 0);
  }

  private async createNewPlacement(userId: string, poolLevel: number, currentTimesEntered: number, triggerOrderId: string): Promise<HeapRewardPlacement> {
    const placement = this.placementRepo.create({
      userId,
      poolLevel,
      totalRewarded: 0,
      timesEntered: currentTimesEntered,
      isActive: true,
      triggerOrderId,
    });
    return this.placementRepo.save(placement);
  }

  private getOrderPoolLevel(amount: number): number {
    if (amount >= 2400) return 2400;
    if (amount >= 500) return 500;
    if (amount >= 100) return 100;
    return 0;
  }

  /**
   * Tính và chia phần trăm ngay lập tức cho bể đồng chia chỉ định
   */
  async distributeInstantPayoutForPool(
    poolLevel: number,
    poolAmount: number,
    triggerOrderPoolLevel: number,
    buyerUserId?: string,
    skipWalletUpdate?: boolean,
  ) {
    this.logger.log(`Starting instant Heap Reward payout for pool ${poolLevel} with amount: ${poolAmount} (triggered by order pool level: ${triggerOrderPoolLevel}, skipWalletUpdate: ${!!skipWalletUpdate})`);
    try {
      // Tải trước các giá trị maxPayout để tránh truy vấn lặp trong giao dịch
      const maxPayouts: Record<number, number> = {
        100: await this.getConfigValue('HEAP_MAX_PAYOUT_100', 200),
        500: await this.getConfigValue('HEAP_MAX_PAYOUT_500', 1000),
        2400: await this.getConfigValue('HEAP_MAX_PAYOUT_2400', 4000),
      };

      await this.placementRepo.manager.transaction(async (manager) => {
        const hPlacementRepo = manager.getRepository(HeapRewardPlacement);
        const hHistoryRepo = manager.getRepository(HeapRewardHistory);
        const hUserRepo = manager.getRepository(User);

        // Đọc active placements ngay trong transaction, lấy thêm relation triggerOrder để check xuất phát điểm
        const activePlacements = await hPlacementRepo.find({
          where: { isActive: true, poolLevel },
          relations: ['user', 'triggerOrder'],
        });

        if (activePlacements.length === 0) {
          this.logger.log(`No active users in Heap pool ${poolLevel}. Skipping distribution.`);
          return;
        }

        // Lọc danh sách người dùng được nhận dựa trên xuất phát điểm đơn hàng kích hoạt
        const eligiblePlacements = activePlacements.filter(placement => {
          // KHÔNG chia cho chính người vừa mua đơn hàng kích hoạt bể này
          if (buyerUserId && placement.userId === buyerUserId) {
            return false;
          }
          // Nếu đơn hàng kích hoạt mới là 2400 PV, và bể đang xét nhỏ hơn đơn hàng kích hoạt này
          if (triggerOrderPoolLevel === 2400 && poolLevel < triggerOrderPoolLevel) {
            // Chỉ những người có đơn hàng kích hoạt gốc >= 2400 PV được nhận (hoặc manually added / legacy không có triggerOrder)
            if (!placement.triggerOrder) {
              return true; // Manually added by admin or legacy placement - always eligible
            }
            const placementTriggerAmount = Number(placement.triggerOrder?.totalAmount || 0);
            const placementTriggerLevel = this.getOrderPoolLevel(placementTriggerAmount);
            return placementTriggerLevel >= 2400;
          }
          // Với các trường hợp đơn 100, 500 hoặc khi poolLevel === triggerOrderPoolLevel thì chia cho tất cả
          return true;
        });

        if (eligiblePlacements.length === 0) {
          this.logger.log(`No eligible users in Heap pool ${poolLevel} for trigger level ${triggerOrderPoolLevel}. Skipping distribution.`);
          return;
        }

        const rewardPerUser = poolAmount / eligiblePlacements.length;
        this.logger.log(`Active eligible Heap users in pool ${poolLevel}: ${eligiblePlacements.length} (total in pool: ${activePlacements.length}). Payout per user: ${rewardPerUser}`);

        for (const placement of eligiblePlacements) {
          const user = placement.user;
          if (!user) continue;

          const maxPayout = maxPayouts[placement.poolLevel] || 0;
          let newTotal = Number(placement.totalRewarded) + rewardPerUser;
          let actualReward = rewardPerUser;
          let isPushOut = false;

          if (newTotal >= maxPayout) {
            actualReward = maxPayout - Number(placement.totalRewarded);
            newTotal = maxPayout;
            isPushOut = true;
          }

          if (actualReward > 0) {
            // Nếu không phải là chạy đồng bộ giả lập/mô phỏng thì mới cộng tiền thực vào ví user
            if (!skipWalletUpdate) {
              await hUserRepo.increment({ id: user.id }, 'withdrawWalletBalance', actualReward);
            }

            const history = hHistoryRepo.create({
              userId: user.id,
              placementId: placement.id,
              amount: actualReward,
              poolLevel,
              rewardDate: new Date(),
            });
            await hHistoryRepo.save(history);

            placement.totalRewarded = newTotal;
            if (isPushOut) {
              placement.isActive = false;
              placement.timesEntered = Number(placement.timesEntered) + 1;
              this.logger.log(`User ${user.id} reached Max Payout in Heap pool ${poolLevel}. Pushed out.`);
            }

            await hPlacementRepo.save(placement);
          }
        }
      });

      this.logger.log(`Instant Heap Reward calculation for pool ${poolLevel} completed.`);
    } catch (e) {
      this.logger.error(`Instant Heap Reward for pool ${poolLevel} failed.`, e);
    }
  }



  /**
   * Đồng bộ các đơn hàng cũ từ ngày chỉ định vào Heap Reward.
   * Tại sao: Có những đơn hàng cũ chưa được tính thưởng đồng chia, việc này giúp quét lại và bù phần thưởng còn thiếu.
   */
  async syncOrdersFromDate(fromDateStr: string, skipWalletUpdate?: boolean): Promise<{
    scanned: number;
    processed: number;
    skipped: number;
    failed: number;
    failedOrderIds: string[];
  }> {
    const fromDate = new Date(fromDateStr);
    if (isNaN(fromDate.getTime())) {
      throw new BadRequestException('Ngày bắt đầu không hợp lệ');
    }

    // Lấy các đơn hàng có trạng thái hợp lệ đã được thanh toán/xác nhận từ ngày chỉ định.
    // Tại sao: Chỉ những đơn hàng đã qua bước xác nhận mới đủ điều kiện xét duyệt chia thưởng.
    const orders = await this.orderRepo.createQueryBuilder('o')
      .where('o.status IN (:...statuses)', {
        statuses: [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      })
      .andWhere('o.createdAt >= :fromDate', { fromDate: fromDate.toISOString() })
      .orderBy('o.createdAt', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .getMany();

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const failedOrderIds: string[] = [];

    for (const order of orders) {
      try {
        // Kiểm tra xem đơn hàng đã kích hoạt vị trí đồng chia nào chưa.
        // Tại sao: Nếu đơn hàng đã được đưa vào hệ thống rồi thì cần bỏ qua để tránh tính trùng phần thưởng.
        const existsInHeap = await this.placementRepo.findOne({
          where: { triggerOrderId: order.id },
        });

        if (existsInHeap) {
          skipped++;
          continue;
        }

        // Thực hiện xử lý đơn hàng để phân chia bể và trích thưởng.
        // Tại sao: Hàm processOrderIfEligible sẽ tự động phân loại mốc PV và xếp người dùng vào các bể thích hợp.
        await this.processOrderIfEligible(order.id, skipWalletUpdate);
        processed++;
      } catch (error) {
        failed++;
        failedOrderIds.push(order.id);
        this.logger.error(`Error syncing order ${order.id} to heap reward: ${(error as any)?.message}`, error);
      }
    }

    return {
      scanned: orders.length,
      processed,
      skipped,
      failed,
      failedOrderIds,
    };
  }

  /**
   * Hoàn tác đồng bộ (rollback/fallback) cho các đơn hàng từ ngày chỉ định.
   * Tại sao: Giúp admin rút lại phần thưởng đồng chia và bể đã xếp nếu đợt chạy trước đó bị lỗi hoặc xếp sai vị trí.
   */
  async rollbackSync(options: {
    fromDateStr: string;
    poolType: string;
    poolLevel?: number;
  }): Promise<{
    scanned: number;
    placementsDeleted: number;
    promisingPlacementsDeleted: number;
    balanceDeducted: number;
    deductedUsers: Record<string, number>;
  }> {
    const fromDate = new Date(options.fromDateStr);
    if (isNaN(fromDate.getTime())) {
      throw new BadRequestException('Ngày bắt đầu không hợp lệ');
    }

    // Lấy các đơn hàng thành công từ ngày chỉ định, sắp xếp tăng dần theo thời gian (từ cũ tới mới - ASC).
    // Tại sao: Việc hoàn tác cần chạy tuần tự từ cũ tới mới để đảm bảo tính nhất quán của dữ liệu.
    const orders = await this.orderRepo.createQueryBuilder('o')
      .where('o.status IN (:...statuses)', {
        statuses: [
          OrderStatus.CONFIRMED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ],
      })
      .andWhere('o.createdAt >= :fromDate', { fromDate: fromDate.toISOString() })
      .orderBy('o.createdAt', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .getMany();

    const orderIds = orders.map(o => o.id);
    if (orderIds.length === 0) {
      return {
        scanned: 0,
        placementsDeleted: 0,
        promisingPlacementsDeleted: 0,
        balanceDeducted: 0,
        deductedUsers: {},
      };
    }

    let placementsDeleted = 0;
    let totalDeducted = 0;
    const deductedUsers: Record<string, number> = {};

    await this.placementRepo.manager.transaction(async (manager) => {
      const hPlacementRepo = manager.getRepository(HeapRewardPlacement);
      const hHistoryRepo = manager.getRepository(HeapRewardHistory);
      const hUserRepo = manager.getRepository(User);

      // A. Xử lý bể Heap Placements & Histories (nếu poolType là 'all' hoặc 'heap')
      if (options.poolType === 'all' || options.poolType === 'heap') {
        const heapPlacementQuery: any = {
          triggerOrderId: In(orderIds)
        };
        if (options.poolLevel) {
          heapPlacementQuery.poolLevel = options.poolLevel;
        }

        const heapPlacements = await hPlacementRepo.find({
          where: heapPlacementQuery
        });

        if (heapPlacements.length > 0) {
          const heapPlacementIds = heapPlacements.map(p => p.id);
          const heapHistories = await hHistoryRepo.find({
            where: { placementId: In(heapPlacementIds) }
          });

          // Khấu trừ lại số dư ví đã cộng cho người dùng từ lịch sử
          for (const history of heapHistories) {
            const amount = Number(history.amount);
            if (amount > 0) {
              await hUserRepo.decrement({ id: history.userId }, 'withdrawWalletBalance', amount);
              deductedUsers[history.userId] = (deductedUsers[history.userId] || 0) + amount;
              totalDeducted += amount;
            }
          }

          // Xóa các Heap placements (cascade xóa lịch sử tương ứng)
          await hPlacementRepo.remove(heapPlacements);
          placementsDeleted = heapPlacements.length;
        }
      }
    });

    return {
      scanned: orders.length,
      placementsDeleted,
      promisingPlacementsDeleted: 0,
      balanceDeducted: totalDeducted,
      deductedUsers,
    };
  }

  // Admin / User APIs
  async getPlacements(query: any) {
    const builder = this.placementRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.triggerOrder', 'triggerOrder')
      .orderBy('p.createdAt', 'DESC');

    if (query.userId) {
      builder.andWhere('p.userId = :userId', { userId: query.userId });
    }
    if (query.poolLevel) {
      builder.andWhere('p.poolLevel = :poolLevel', { poolLevel: Number(query.poolLevel) });
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
    if (query.poolLevel) {
      builder.andWhere('h.poolLevel = :poolLevel', { poolLevel: Number(query.poolLevel) });
    }

    const rawLimit = Number(query.limit);
    if (!isNaN(rawLimit) && rawLimit > 0) {
      builder.take(Math.min(rawLimit, 100));
    }

    return builder.getMany();
  }

  async addManualPlacement(queryStr: string, poolLevel: number) {
    if (!queryStr) {
      throw new BadRequestException('Vui lòng cung cấp thông tin tìm kiếm user (ID, username hoặc email).');
    }
    const user = await this.userRepo.findOne({
      where: [
        { id: queryStr },
        { username: queryStr },
        { email: queryStr },
      ],
    });
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng phù hợp.');
    }

    const validPools = [100, 500, 2400];
    if (!validPools.includes(poolLevel)) {
      throw new BadRequestException('Bể đồng chia không hợp lệ. Phải là 100, 500 hoặc 2400.');
    }

    const existing = await this.placementRepo.findOne({
      where: { userId: user.id, poolLevel, isActive: true },
    });
    if (existing) {
      throw new BadRequestException('Người dùng này đã có vị trí hoạt động trong bể này rồi.');
    }

    const placement = this.placementRepo.create({
      userId: user.id,
      poolLevel,
      isActive: true,
      totalRewarded: 0,
      triggerOrderId: null,
      timesEntered: 1,
    });
    await this.placementRepo.save(placement);
    return { success: true, placement };
  }
}
