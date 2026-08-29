import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentPool } from './entities/agent-pool.entity';
import { AgentPoolMember } from './entities/agent-pool-member.entity';
import { AgentPoolHistory } from './entities/agent-pool-history.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';

@Injectable()
export class AgentPoolService {
  static calculatePoolRewardUsd({
    orderNetUsd,
    poolPercent,
    memberCount,
  }: {
    orderNetUsd: number;
    poolPercent: number;
    memberCount: number;
  }): {
    poolTotalUsd: number;
    rewardPerMemberUsd: number;
  } {
    const safeMemberCount = Math.max(1, Number(memberCount) || 1);
    const netUsd = Number(orderNetUsd) || 0;
    const poolShareUsd = (netUsd * (Number(poolPercent) || 0)) / 100;
    const rewardPerMemberUsd = poolShareUsd / safeMemberCount;

    return {
      poolTotalUsd: poolShareUsd,
      rewardPerMemberUsd,
    };
  }

  static calculatePoolRewardVnd({
    orderNetUsd,
    poolPercent,
    memberCount,
    rateVnd,
  }: {
    orderNetUsd: number;
    poolPercent: number;
    memberCount: number;
    rateVnd: number;
  }): {
    poolTotalVnd: number;
    rewardPerMemberVnd: number;
  } {
    const safeRate = Number.isFinite(rateVnd) && rateVnd > 0 ? rateVnd : 25000;
    const { poolTotalUsd, rewardPerMemberUsd } = this.calculatePoolRewardUsd({
      orderNetUsd,
      poolPercent,
      memberCount,
    });

    return {
      poolTotalVnd: poolTotalUsd * safeRate,
      rewardPerMemberVnd: rewardPerMemberUsd * safeRate,
    };
  }
  private readonly logger = new Logger(AgentPoolService.name);

  constructor(
    @InjectRepository(AgentPool)
    private poolRepo: Repository<AgentPool>,
    @InjectRepository(AgentPoolMember)
    private memberRepo: Repository<AgentPoolMember>,
    @InjectRepository(AgentPoolHistory)
    private historyRepo: Repository<AgentPoolHistory>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(BankingConfig)
    private bankingConfigRepo: Repository<BankingConfig>,
  ) {}

  private async getUsdtToVndRate(): Promise<number> {
    const config = await this.bankingConfigRepo.findOne({ where: { id: 1 } });
    const rate = Number(config?.usdtPriceVnd ?? 25000);
    return Number.isFinite(rate) && rate > 0 ? rate : 25000;
  }

  // ── 1. Pool Management ───────────────────────────────────────────────────

  async getAllPools(): Promise<AgentPool[]> {
    return this.poolRepo.find({
      order: { code: 'ASC', createdAt: 'ASC' },
    });
  }

  async createPool(dto: {
    code: string;
    name: string;
    percent: number;
    note?: string;
  }): Promise<AgentPool> {
    const code = (dto.code || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Mã bể (code) không được để trống');
    if (!dto.name) throw new BadRequestException('Tên bể không được để trống');
    if (typeof dto.percent !== 'number' || dto.percent < 0 || dto.percent > 100) {
      throw new BadRequestException('Phần trăm (%) bể phải từ 0 đến 100');
    }

    const existing = await this.poolRepo.findOne({ where: { code } });
    if (existing) {
      throw new BadRequestException(`Bể với mã "${code}" đã tồn tại`);
    }

    const pool = this.poolRepo.create({
      code,
      name: dto.name.trim(),
      percent: dto.percent,
      isActive: true,
      note: dto.note || '',
    });
    return this.poolRepo.save(pool);
  }

  async updatePool(
    id: string,
    dto: { name?: string; percent?: number; isActive?: boolean; note?: string },
  ): Promise<AgentPool> {
    const pool = await this.poolRepo.findOne({ where: { id } });
    if (!pool) throw new NotFoundException('Không tìm thấy bể đại lý');

    if (dto.name !== undefined) pool.name = dto.name.trim();
    if (dto.percent !== undefined) {
      if (typeof dto.percent !== 'number' || dto.percent < 0 || dto.percent > 100) {
        throw new BadRequestException('Phần trăm (%) bể phải từ 0 đến 100');
      }
      pool.percent = dto.percent;
    }
    if (dto.isActive !== undefined) pool.isActive = dto.isActive;
    if (dto.note !== undefined) pool.note = dto.note;

    return this.poolRepo.save(pool);
  }

  async deletePool(id: string): Promise<void> {
    const pool = await this.poolRepo.findOne({ where: { id } });
    if (!pool) throw new NotFoundException('Không tìm thấy bể đại lý');
    await this.poolRepo.remove(pool);
  }

  // ── 2. Member Management ─────────────────────────────────────────────────

  async getMembers(query: { poolId?: string; isActive?: string; search?: string }) {
    const qb = this.memberRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.pool', 'pool')
      .leftJoinAndSelect('m.user', 'user')
      .orderBy('m.createdAt', 'DESC');

    if (query.poolId) {
      qb.andWhere('m.poolId = :poolId', { poolId: query.poolId });
    }

    if (query.isActive !== undefined && query.isActive !== '') {
      const activeBool = query.isActive === 'true' || query.isActive === '1';
      qb.andWhere('m.isActive = :activeBool', { activeBool });
    }

    if (query.search) {
      const s = `%${query.search.trim()}%`;
      qb.andWhere(
        '(user.id LIKE :s OR user.username LIKE :s OR user.email LIKE :s OR user.phone LIKE :s)',
        { s },
      );
    }

    return qb.getMany();
  }

  async addMember(dto: {
    poolId: string;
    queryStr: string;
    note?: string;
  }): Promise<AgentPoolMember> {
    const pool = await this.poolRepo.findOne({ where: { id: dto.poolId } });
    if (!pool) throw new NotFoundException('Bể đại lý không tồn tại');

    const queryStr = (dto.queryStr || '').trim();
    if (!queryStr) {
      throw new BadRequestException('Vui lòng cung cấp Username, Email hoặc ID người dùng');
    }

    const user = await this.userRepo.findOne({
      where: [
        { id: queryStr },
        { username: queryStr },
        { email: queryStr },
      ],
    });
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng phù hợp');
    }

    const existing = await this.memberRepo.findOne({
      where: { poolId: pool.id, userId: user.id },
    });

    if (existing) {
      if (existing.isActive) {
        throw new BadRequestException('Người dùng đã có trong bể này và đang ở trạng thái Hoạt động');
      }
      existing.isActive = true;
      if (dto.note) existing.note = dto.note;
      return this.memberRepo.save(existing);
    }

    const member = this.memberRepo.create({
      poolId: pool.id,
      userId: user.id,
      totalRewarded: 0,
      isActive: true,
      note: dto.note || '',
    });
    return this.memberRepo.save(member);
  }

  async updateMemberStatus(id: string, isActive: boolean): Promise<AgentPoolMember> {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) throw new NotFoundException('Không tìm thấy thành viên trong bể');
    member.isActive = isActive;
    return this.memberRepo.save(member);
  }

  async removeMember(id: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { id } });
    if (!member) throw new NotFoundException('Không tìm thấy thành viên trong bể');
    await this.memberRepo.remove(member);
  }

  // ── 3. Order Processing Core Logic ─────────────────────────────────────────

  /**
   * Process profit pool sharing when an order is approved/confirmed.
   * Calculate net value (Order Total - VAT - Shipping Fee).
   * Distribute each pool's % equally among active members in that pool.
   */
  async processOrder(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order) {
        this.logger.warn(`Order ${orderId} not found for AgentPool processing.`);
        return;
      }

      const totalAmt = Number(order.totalAmount) || 0;
      const vatAmt = Number(order.vatAmount) || 0;
      const shipFee = Number(order.shippingFee) || 0;

      // Giá trị thực của đơn hàng đã trừ VAT và phí vận chuyển
      const orderNetAmount = Math.max(0, totalAmt - vatAmt - shipFee);

      if (orderNetAmount <= 0) {
        this.logger.log(`Order ${orderId} net amount is ${orderNetAmount}. Skipping AgentPool distribution.`);
        return;
      }

      const activePools = await this.poolRepo.find({
        where: { isActive: true },
      });

      if (activePools.length === 0) {
        this.logger.log(`No active Agent Pools configured. Skipping distribution for order ${orderId}.`);
        return;
      }

      for (const pool of activePools) {
        const percent = Number(pool.percent) || 0;
        if (percent <= 0) continue;

        const members = await this.memberRepo.find({
          where: { poolId: pool.id, isActive: true },
          relations: ['user'],
        });

        if (members.length === 0) {
          this.logger.log(`Agent Pool ${pool.code} has 0 active members. Skipping for order ${orderId}.`);
          continue;
        }

        const { poolTotalUsd, rewardPerMemberUsd } = AgentPoolService.calculatePoolRewardUsd({
          orderNetUsd: orderNetAmount,
          poolPercent: percent,
          memberCount: members.length,
        });

        const rewardPerMember = Number((rewardPerMemberUsd || 0).toFixed(4));
        const poolTotalAmount = Number((poolTotalUsd || 0).toFixed(4));

        if (rewardPerMember <= 0) continue;

        // Run distribution in DB Transaction per pool
        await this.poolRepo.manager.transaction(async (manager) => {
          const tMemberRepo = manager.getRepository(AgentPoolMember);
          const tHistoryRepo = manager.getRepository(AgentPoolHistory);
          const tUserRepo = manager.getRepository(User);

          for (const m of members) {
            if (!m.userId) continue;

            // 1. Plus money to user withdraw wallet balance using USD as the source of truth
            await tUserRepo.increment(
              { id: m.userId },
              'withdrawWalletBalance',
              rewardPerMember,
            );

            // 2. Plus total rewarded for member
            await tMemberRepo.increment(
              { id: m.id },
              'totalRewarded',
              rewardPerMember,
            );

            // 3. Save History (store values in USD; UI converts to VND only for display)
            const history = tHistoryRepo.create({
              poolId: pool.id,
              memberId: m.id,
              userId: m.userId,
              orderId: order.id,
              orderTotalAmount: totalAmt,
              orderNetAmount: orderNetAmount,
              poolPercent: percent,
              poolTotalAmount: poolTotalAmount,
              memberCount: members.length,
              rewardAmount: rewardPerMember,
            });
            await tHistoryRepo.save(history);
          }
        });

        this.logger.log(
          `Agent Pool ${pool.code} (${percent}%): Distributed total ${poolTotalAmount} USD (${rewardPerMember}/user) to ${members.length} members for order ${orderId}.`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to process AgentPool for order ${orderId}`, error);
    }
  }

  // ── 4. History & Reporting ─────────────────────────────────────────────────

  async getHistories(query: { poolId?: string; userId?: string; orderId?: string; limit?: string }) {
    const qb = this.historyRepo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.pool', 'pool')
      .leftJoinAndSelect('h.user', 'user')
      .leftJoinAndSelect('h.order', 'order')
      .orderBy('h.createdAt', 'DESC');

    if (query.poolId) {
      qb.andWhere('h.poolId = :poolId', { poolId: query.poolId });
    }
    if (query.userId) {
      qb.andWhere('h.userId = :userId', { userId: query.userId });
    }
    if (query.orderId) {
      qb.andWhere('h.orderId = :orderId', { orderId: query.orderId });
    }

    const limit = Math.min(Number(query.limit) || 100, 500);
    qb.take(limit);

    return qb.getMany();
  }

  async getUserSummary(userId: string) {
    const members = await this.memberRepo.find({
      where: { userId },
      relations: ['pool'],
    });

    const totalRewardedResult = await this.historyRepo
      .createQueryBuilder('h')
      .select('SUM(h.rewardAmount)', 'sum')
      .where('h.userId = :userId', { userId })
      .getRawOne();

    const totalRewarded = parseFloat(totalRewardedResult?.sum || '0');

    return {
      userId,
      myPools: members.map((m) => ({
        memberId: m.id,
        poolId: m.poolId,
        poolCode: m.pool?.code,
        poolName: m.pool?.name,
        poolPercent: m.pool?.percent,
        totalRewarded: m.totalRewarded,
        isActive: m.isActive,
        joinedAt: m.createdAt,
      })),
      totalAgentPoolRewards: totalRewarded,
    };
  }
}
