import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeapRewardPlacement } from './entities/heap-reward-placement.entity';
import { HeapRewardHistory } from './entities/heap-reward-history.entity';
import { PromisingProductPlacement } from './entities/promising-product-placement.entity';
import { PromisingProductHistory } from './entities/promising-product-history.entity';
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
    @InjectRepository(PromisingProductPlacement)
    private promisingPlacementRepo: Repository<PromisingProductPlacement>,
    @InjectRepository(PromisingProductHistory)
    private promisingHistoryRepo: Repository<PromisingProductHistory>,
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
  async processOrderIfEligible(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order || !order.userId) return;

      // YÊU CẦU 3: Đơn hàng chỉ bao gồm đúng 1 sản phẩm
      if (!order.items || order.items.length !== 1) {
        this.logger.log(`[HEAP/PROMISING] Order ${orderId} does not contain exactly 1 item. Skipping.`);
        return;
      }

      const item = order.items[0];
      const product = await this.productRepo.findOne({ where: { id: item.productId } });
      
      // YÊU CẦU 2 & 3: Sản phẩm đó phải được gắn cờ triển vọng
      if (!product || !product.isPromisingProduct) {
        this.logger.log(`[HEAP/PROMISING] Product ${item.productId} in order ${orderId} is not flagged as a promising product. Skipping.`);
        return;
      }

      const user = await this.userRepo.findOne({ where: { id: order.userId } });
      if (!user) return;

      const orderTotal = Number(order.totalAmount) || 0;

      // Phân loại mốc PV dựa trên tổng giá trị đơn hàng
      let poolLevel = 0;
      if (orderTotal >= 5000) {
        poolLevel = 5000;
      } else if (orderTotal >= 3000) {
        poolLevel = 3000;
      } else if (orderTotal >= 500) {
        poolLevel = 500;
      } else if (orderTotal >= 100) {
        poolLevel = 100;
      }

      if (poolLevel === 0) {
        this.logger.log(`[HEAP/PROMISING] Order ${orderId} total ${orderTotal} PV does not qualify for any pool (min 100 PV).`);
        return;
      }

      // Xử lý nhảy cây đồng chia (Heap Reward)
      const poolsToJoin: number[] = [];
      if (poolLevel === 5000) {
        poolsToJoin.push(100, 500, 3000, 5000);
      } else if (poolLevel === 3000) {
        poolsToJoin.push(100, 500, 3000);
      } else if (poolLevel === 500) {
        poolsToJoin.push(500);
      } else if (poolLevel === 100) {
        poolsToJoin.push(100);
      }

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

      // Phân phối thưởng đồng chia cho các bể được đóng góp
      for (const p of poolsToJoin) {
        const rewardPercent = await this.getConfigValue(`HEAP_POOL_PERCENT_${p}`, p === 100 ? 5 : 10);
        const poolAmount = orderTotal * (rewardPercent / 100);
        await this.distributeInstantPayoutForPool(p, poolAmount, poolLevel);
      }

      // Xử lý Hàng đợi Doanh số sản phẩm triển vọng (Promising Product Queue)
      if (poolLevel === 3000 || poolLevel === 5000) {
        const activeCount = await this.promisingPlacementRepo.count({
          where: { poolLevel, isActive: true },
        });

        const timesEntered = await this.promisingPlacementRepo.count({
          where: { userId: user.id, poolLevel },
        });

        // Chỉ cho phép tối đa 10 ID hoạt động nhận thưởng đồng thời
        const isActive = activeCount < 10;

        const promisingPlacement = this.promisingPlacementRepo.create({
          userId: user.id,
          poolLevel,
          totalRewarded: 0,
          timesEntered,
          isActive,
          triggerOrderId: order.id,
        });
        await this.promisingPlacementRepo.save(promisingPlacement);
        this.logger.log(`User ${user.id} entered Promising Product queue ${poolLevel}. Active: ${isActive}`);

        // Trích thưởng cho quỹ doanh số sản phẩm triển vọng tương ứng
        const promisingPercent = await this.getConfigValue(`PROMISING_POOL_PERCENT_${poolLevel}`, poolLevel === 3000 ? 5 : 10);
        const promisingPoolAmount = orderTotal * (promisingPercent / 100);
        await this.distributePromisingPayout(poolLevel, promisingPoolAmount);
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

  private async createNewPlacement(userId: string, poolLevel: number, currentTimesEntered: number, triggerOrderId: string) {
    const placement = this.placementRepo.create({
      userId,
      poolLevel,
      totalRewarded: 0,
      timesEntered: currentTimesEntered,
      isActive: true,
      triggerOrderId,
    });
    await this.placementRepo.save(placement);
  }

  private getOrderPoolLevel(amount: number): number {
    if (amount >= 5000) return 5000;
    if (amount >= 3000) return 3000;
    if (amount >= 500) return 500;
    if (amount >= 100) return 100;
    return 0;
  }

  /**
   * Tính và chia phần trăm ngay lập tức cho bể đồng chia chỉ định
   */
  async distributeInstantPayoutForPool(poolLevel: number, poolAmount: number, triggerOrderPoolLevel: number) {
    this.logger.log(`Starting instant Heap Reward payout for pool ${poolLevel} with amount: ${poolAmount} (triggered by order pool level: ${triggerOrderPoolLevel})`);
    try {
      // Tải trước các giá trị maxPayout để tránh truy vấn lặp trong giao dịch
      const maxPayouts: Record<number, number> = {
        100: await this.getConfigValue('HEAP_MAX_PAYOUT_100', 200),
        500: await this.getConfigValue('HEAP_MAX_PAYOUT_500', 1000),
        3000: await this.getConfigValue('HEAP_MAX_PAYOUT_3000', 6000),
        5000: await this.getConfigValue('HEAP_MAX_PAYOUT_5000', 10000),
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
          // Nếu đơn hàng kích hoạt mới là 3000 PV hoặc 5000 PV, và bể đang xét nhỏ hơn đơn hàng kích hoạt này
          if ((triggerOrderPoolLevel === 3000 || triggerOrderPoolLevel === 5000) && poolLevel < triggerOrderPoolLevel) {
            // Chỉ những người có đơn hàng kích hoạt gốc >= 3000 PV được nhận
            const placementTriggerAmount = Number(placement.triggerOrder?.totalAmount || 0);
            const placementTriggerLevel = this.getOrderPoolLevel(placementTriggerAmount);
            return placementTriggerLevel >= 3000;
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
            await hUserRepo.increment({ id: user.id }, 'withdrawWalletBalance', actualReward);

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
   * Tính và chia phần trăm doanh số sản phẩm triển vọng cho hàng đợi chỉ định
   */
  async distributePromisingPayout(poolLevel: number, poolAmount: number) {
    this.logger.log(`Starting Promising Product reward distribution for pool ${poolLevel} with amount: ${poolAmount}`);
    try {
      const defaultMax = poolLevel === 3000 ? 4000 : 8000;
      const maxPayout = await this.getConfigValue(`PROMISING_MAX_PAYOUT_${poolLevel}`, defaultMax);

      await this.promisingPlacementRepo.manager.transaction(async (manager) => {
        const pPlacementRepo = manager.getRepository(PromisingProductPlacement);
        const pHistoryRepo = manager.getRepository(PromisingProductHistory);
        const pUserRepo = manager.getRepository(User);

        // Đọc active placements ngay trong transaction để đảm bảo track thay đổi chính xác
        const activePlacements = await pPlacementRepo.find({
          where: { isActive: true, poolLevel },
          relations: ['user'],
          order: { createdAt: 'ASC' },
        });

        if (activePlacements.length === 0) {
          this.logger.log(`No active users in Promising pool ${poolLevel}. Skipping distribution.`);
          return;
        }

        const rewardPerUser = poolAmount / activePlacements.length;
        this.logger.log(`Active Promising users in pool ${poolLevel}: ${activePlacements.length}. Payout per user: ${rewardPerUser}`);

        for (const placement of activePlacements) {
          const user = placement.user;
          if (!user) continue;

          let newTotal = Number(placement.totalRewarded) + rewardPerUser;
          let actualReward = rewardPerUser;
          let isPushOut = false;

          if (newTotal >= maxPayout) {
            actualReward = maxPayout - Number(placement.totalRewarded);
            newTotal = maxPayout;
            isPushOut = true;
          }

          if (actualReward > 0) {
            await pUserRepo.increment({ id: user.id }, 'withdrawWalletBalance', actualReward);

            const history = pHistoryRepo.create({
              userId: user.id,
              placementId: placement.id,
              amount: actualReward,
              poolLevel,
              rewardDate: new Date(),
            });
            await pHistoryRepo.save(history);

            placement.totalRewarded = newTotal;
            if (isPushOut) {
              placement.isActive = false;
              placement.timesEntered = Number(placement.timesEntered) + 1;
              this.logger.log(`User ${user.id} reached Max Payout in Promising pool ${poolLevel}. Pushed out.`);

              // Tự động kích hoạt người tiếp theo trong hàng đợi (FIFO)
              const nextInQueue = await pPlacementRepo.findOne({
                where: { poolLevel, isActive: false, totalRewarded: 0 },
                order: { createdAt: 'ASC' },
              });
              if (nextInQueue) {
                nextInQueue.isActive = true;
                await pPlacementRepo.save(nextInQueue);
                this.logger.log(`Activated user ${nextInQueue.userId} in promising pool ${poolLevel} from queue.`);
              }
            }

            await pPlacementRepo.save(placement);
          }
        }
      });

      this.logger.log(`Promising Product reward distribution for pool ${poolLevel} completed.`);
    } catch (e) {
      this.logger.error(`Promising Product reward distribution for pool ${poolLevel} failed.`, e);
    }
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

  // Promising Product APIs
  async getPromisingPlacements(query: any) {
    const builder = this.promisingPlacementRepo.createQueryBuilder('p')
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

  async deletePromisingPlacement(id: string) {
    return this.promisingPlacementRepo.delete(id);
  }

  async getPromisingHistories(query: any) {
    const builder = this.promisingHistoryRepo.createQueryBuilder('h')
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
}
