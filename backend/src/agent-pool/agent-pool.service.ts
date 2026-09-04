import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { AgentPool } from './entities/agent-pool.entity';
import { AgentPoolMember } from './entities/agent-pool-member.entity';
import { AgentPoolHistory } from './entities/agent-pool-history.entity';
import { User } from '../user/entities/user.entity';
import { Order, OrderStatus } from '../order/entities/order.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';
import { runWithDeadlockRetry } from '../common/utils';
import {
  DEFAULT_RECONSUMPTION_WALLET_PERCENT,
  DEFAULT_WITHDRAW_WALLET_PERCENT,
} from '../common/constants/wallet-distribution';

export interface WalletDistribution {
  withdrawPercent: number;
  reconsumptionPercent: number;
  taxPercent: number;
}

@Injectable()
export class AgentPoolService {
  /**
   * Chia phần thưởng của một thành viên thành ví rút / ví tiêu dùng / thuế.
   * Phần thuế lấy bằng số dư còn lại để tổng ba phần luôn đúng bằng reward.
   */
  static splitRewardUsd(
    rewardUsd: number,
    distribution: WalletDistribution,
  ): {
    withdrawAmount: number;
    reconsumptionAmount: number;
    taxAmount: number;
  } {
    const reward = Number(rewardUsd) || 0;
    const withdrawAmount = Number(
      ((reward * distribution.withdrawPercent) / 100).toFixed(4),
    );
    const reconsumptionAmount = Number(
      ((reward * distribution.reconsumptionPercent) / 100).toFixed(4),
    );
    const taxAmount = Number(
      (reward - withdrawAmount - reconsumptionAmount).toFixed(4),
    );

    return { withdrawAmount, reconsumptionAmount, taxAmount };
  }

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
    @InjectRepository(SystemConfig)
    private systemConfigRepo: Repository<SystemConfig>,
  ) {}

  private async getUsdtToVndRate(): Promise<number> {
    const config = await this.bankingConfigRepo.findOne({ where: { id: 1 } });
    const rate = Number(config?.usdtPriceVnd ?? 25000);
    return Number.isFinite(rate) && rate > 0 ? rate : 25000;
  }

  /**
   * Tỷ lệ chia ví dùng chung với hoa hồng: mặc định 70% ví rút, 20% ví tiêu
   * dùng, 10% còn lại là thuế/VAT bị trừ thẳng, không cộng vào ví nào.
   */
  async getWalletDistribution(): Promise<WalletDistribution> {
    const [withdrawRow, reconsumptionRow] = await Promise.all([
      this.systemConfigRepo.findOne({
        where: { key: 'commissionWithdrawWalletPercent' },
      }),
      this.systemConfigRepo.findOne({
        where: { key: 'commissionDepositWalletPercent' },
      }),
    ]);

    const parsePercent = (raw: string | undefined, fallback: number): number => {
      const parsed = parseFloat(raw ?? '');
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return fallback;
      return parsed;
    };

    let withdrawPercent = parsePercent(withdrawRow?.value, DEFAULT_WITHDRAW_WALLET_PERCENT);
    let reconsumptionPercent = parsePercent(
      reconsumptionRow?.value,
      DEFAULT_RECONSUMPTION_WALLET_PERCENT,
    );

    // Cấu hình hỏng (tổng > 100%) sẽ chia ra nhiều tiền hơn phần thưởng thật,
    // nên quay về mặc định thay vì cộng thừa vào ví người dùng.
    if (withdrawPercent + reconsumptionPercent > 100) {
      this.logger.warn(
        `Wallet distribution config invalid (withdraw=${withdrawPercent}%, reconsumption=${reconsumptionPercent}%). Falling back to ${DEFAULT_WITHDRAW_WALLET_PERCENT}/${DEFAULT_RECONSUMPTION_WALLET_PERCENT}.`,
      );
      withdrawPercent = DEFAULT_WITHDRAW_WALLET_PERCENT;
      reconsumptionPercent = DEFAULT_RECONSUMPTION_WALLET_PERCENT;
    }

    return {
      withdrawPercent,
      reconsumptionPercent,
      taxPercent: Number(
        (100 - withdrawPercent - reconsumptionPercent).toFixed(2),
      ),
    };
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
        order: { code: 'ASC' },
      });

      if (activePools.length === 0) {
        this.logger.log(`No active Agent Pools configured. Skipping distribution for order ${orderId}.`);
        return;
      }

      const distribution = await this.getWalletDistribution();

      for (const pool of activePools) {
        // Một bể lỗi (deadlock, dữ liệu hỏng...) không được làm hỏng các bể còn
        // lại: bắt lỗi trong vòng lặp để những bể sau vẫn được chia.
        try {
          await this.distributePool(pool, order, orderNetAmount, distribution);
        } catch (error) {
          this.logger.error(
            `Agent Pool ${pool.code}: distribution failed for order ${orderId}`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process AgentPool for order ${orderId}`, error);
    }
  }

  /**
   * Distribute one pool's share of a single order to its active members.
   * Runs in its own transaction and is replayed on a transient lock error.
   */
  private async distributePool(
    pool: AgentPool,
    order: Order,
    orderNetAmount: number,
    distribution: WalletDistribution,
  ): Promise<void> {
    const percent = Number(pool.percent) || 0;
    if (percent <= 0) return;

    // Idempotent: đơn nào đã chia cho bể này rồi thì không chia lần hai, để có
    // thể chạy lại an toàn những đơn bị hụt bể vì lỗi.
    const alreadyDistributed = await this.historyRepo.count({
      where: { orderId: order.id, poolId: pool.id },
    });
    if (alreadyDistributed > 0) {
      this.logger.log(
        `Agent Pool ${pool.code} already distributed for order ${order.id}. Skipping.`,
      );
      return;
    }

    const members = await this.memberRepo.find({
      where: { poolId: pool.id, isActive: true },
      relations: ['user'],
      // Khoá các hàng user theo một thứ tự cố định giữa mọi bể và mọi đơn để
      // giảm khả năng hai transaction khoá chéo nhau.
      order: { userId: 'ASC' },
    });

    if (members.length === 0) {
      this.logger.log(
        `Agent Pool ${pool.code} has 0 active members. Skipping for order ${order.id}.`,
      );
      return;
    }

    const { poolTotalUsd, rewardPerMemberUsd } = AgentPoolService.calculatePoolRewardUsd({
      orderNetUsd: orderNetAmount,
      poolPercent: percent,
      memberCount: members.length,
    });

    const rewardPerMember = Number((rewardPerMemberUsd || 0).toFixed(4));
    const poolTotalAmount = Number((poolTotalUsd || 0).toFixed(4));

    if (rewardPerMember <= 0) return;

    const totalAmt = Number(order.totalAmount) || 0;

    // Run distribution in DB Transaction per pool
    await runWithDeadlockRetry(
      () =>
        this.poolRepo.manager.transaction(async (manager) => {
          const tMemberRepo = manager.getRepository(AgentPoolMember);
          const tHistoryRepo = manager.getRepository(AgentPoolHistory);
          const tUserRepo = manager.getRepository(User);

          for (const m of members) {
            if (!m.userId) continue;

            // 1. Chia phần thưởng: ví rút / ví tiêu dùng / thuế bị trừ thẳng.
            //    USD là đơn vị gốc, VND chỉ quy đổi khi hiển thị.
            const { withdrawAmount, reconsumptionAmount, taxAmount } =
              AgentPoolService.splitRewardUsd(rewardPerMember, distribution);

            if (withdrawAmount > 0) {
              await tUserRepo.increment(
                { id: m.userId },
                'withdrawWalletBalance',
                withdrawAmount,
              );
            }

            if (reconsumptionAmount > 0) {
              await tUserRepo.increment(
                { id: m.userId },
                'reconsumptionWalletBalance',
                reconsumptionAmount,
              );
            }

            // 2. Plus total rewarded for member (ghi nhận phần thưởng gộp)
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
              withdrawAmount,
              reconsumptionAmount,
              taxAmount,
            });
            await tHistoryRepo.save(history);
          }
        }),
      {
        onRetry: (attempt, error) =>
          this.logger.warn(
            `Agent Pool ${pool.code}: lock conflict on order ${order.id} (attempt ${attempt}), retrying — ${error?.message}`,
          ),
      },
    );

    this.logger.log(
      `Agent Pool ${pool.code} (${percent}%): Distributed total ${poolTotalAmount} USD (${rewardPerMember}/user) to ${members.length} members for order ${order.id}. Split: withdraw ${distribution.withdrawPercent}%, reconsumption ${distribution.reconsumptionPercent}%, tax ${distribution.taxPercent}%.`,
    );
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
      .addSelect('SUM(h.withdrawAmount)', 'withdrawSum')
      .addSelect('SUM(h.reconsumptionAmount)', 'reconsumptionSum')
      .where('h.userId = :userId', { userId })
      .getRawOne();

    const totalRewarded = parseFloat(totalRewardedResult?.sum || '0');
    const totalWithdrawCredited = parseFloat(
      totalRewardedResult?.withdrawSum || '0',
    );
    const totalReconsumptionCredited = parseFloat(
      totalRewardedResult?.reconsumptionSum || '0',
    );

    return {
      userId,
      walletDistribution: await this.getWalletDistribution(),
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
      totalAgentPoolWithdrawCredited: totalWithdrawCredited,
      totalAgentPoolReconsumptionCredited: totalReconsumptionCredited,
    };
  }

  // ── 5. Backfill (bù các bể bị hụt) ────────────────────────────────────────

  /**
   * Đơn ở các trạng thái này đã được duyệt nên lẽ ra đã chia đủ mọi bể.
   */
  private static readonly BACKFILL_ORDER_STATUSES = [
    OrderStatus.CONFIRMED,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
  ];

  private orderNetAmount(order: Order): number {
    const totalAmt = Number(order.totalAmount) || 0;
    const vatAmt = Number(order.vatAmount) || 0;
    const shipFee = Number(order.shippingFee) || 0;
    return Math.max(0, totalAmt - vatAmt - shipFee);
  }

  /**
   * Tìm các đơn đã duyệt nhưng thiếu lịch sử chia của một hoặc nhiều bể, kèm số
   * tiền dự kiến sẽ cộng nếu chạy bù. Chỉ đọc, không ghi gì.
   */
  async previewBackfill(query: { since?: string; limit?: string } = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 200, 1), 1000);
    const since = query.since ? new Date(query.since) : null;
    if (since && isNaN(since.getTime())) {
      throw new BadRequestException('Tham số "since" không phải ngày hợp lệ');
    }

    const distribution = await this.getWalletDistribution();
    const pools = await this.poolRepo.find({ order: { code: 'ASC' } });

    // Bể không chia được (tạm dừng, 0%, không có thành viên) thì việc thiếu
    // lịch sử là đúng, không tính là hụt.
    const payablePools: Array<{ pool: AgentPool; memberCount: number }> = [];
    const skippedPools: Array<{ code: string; reason: string }> = [];

    for (const pool of pools) {
      const memberCount = await this.memberRepo.count({
        where: { poolId: pool.id, isActive: true },
      });
      if (!pool.isActive) {
        skippedPools.push({ code: pool.code, reason: 'Bể đang tạm dừng' });
      } else if (Number(pool.percent) <= 0) {
        skippedPools.push({ code: pool.code, reason: 'Phần trăm bể bằng 0' });
      } else if (memberCount === 0) {
        skippedPools.push({
          code: pool.code,
          reason: 'Bể không có thành viên hoạt động',
        });
      } else {
        payablePools.push({ pool, memberCount });
      }
    }

    if (payablePools.length === 0) {
      return {
        distribution,
        payablePools: [],
        skippedPools,
        orders: [],
        totalOrders: 0,
        totalMissingPools: 0,
        totalAmountUsd: 0,
        totalWithdrawUsd: 0,
        totalReconsumptionUsd: 0,
        truncated: false,
      };
    }

    const orders = await this.orderRepo.find({
      where: {
        status: In(AgentPoolService.BACKFILL_ORDER_STATUSES),
        ...(since ? { createdAt: MoreThanOrEqual(since) } : {}),
      },
      select: [
        'id',
        'status',
        'createdAt',
        'totalAmount',
        'vatAmount',
        'shippingFee',
      ],
      order: { createdAt: 'DESC' },
    });

    // Lấy toàn bộ cặp (đơn, bể) đã chia trong một lượt: hỏi từng đơn một sẽ
    // thành hàng nghìn query khi hệ thống có nhiều đơn.
    const paidByOrder = new Map<string, Set<string>>();
    const CHUNK = 500;
    for (let i = 0; i < orders.length; i += CHUNK) {
      const ids = orders.slice(i, i + CHUNK).map((o) => o.id);
      const rowsRaw = await this.historyRepo
        .createQueryBuilder('h')
        .select('h.orderId', 'orderId')
        .addSelect('h.poolId', 'poolId')
        .where('h.orderId IN (:...ids)', { ids })
        .groupBy('h.orderId')
        .addGroupBy('h.poolId')
        .getRawMany();
      for (const r of rowsRaw as Array<{ orderId: string; poolId: string }>) {
        const set = paidByOrder.get(r.orderId) || new Set<string>();
        set.add(r.poolId);
        paidByOrder.set(r.orderId, set);
      }
    }

    const rows: any[] = [];
    let totalMissingPools = 0;
    let totalAmountUsd = 0;
    let totalWithdrawUsd = 0;
    let totalReconsumptionUsd = 0;
    let truncated = false;

    for (const order of orders) {
      const netAmount = this.orderNetAmount(order);
      if (netAmount <= 0) continue;

      const paidPoolIds = paidByOrder.get(order.id) || new Set<string>();

      const missing: any[] = [];
      for (const { pool, memberCount } of payablePools) {
        if (paidPoolIds.has(pool.id)) continue;
        // Bể tạo sau đơn thì đơn đó chưa từng thuộc bể, không phải hụt.
        if (pool.createdAt > order.createdAt) continue;

        const { poolTotalUsd, rewardPerMemberUsd } =
          AgentPoolService.calculatePoolRewardUsd({
            orderNetUsd: netAmount,
            poolPercent: Number(pool.percent),
            memberCount,
          });
        const rewardPerMember = Number((rewardPerMemberUsd || 0).toFixed(4));
        if (rewardPerMember <= 0) continue;

        const split = AgentPoolService.splitRewardUsd(
          rewardPerMember,
          distribution,
        );

        missing.push({
          poolId: pool.id,
          poolCode: pool.code,
          poolName: pool.name,
          poolPercent: Number(pool.percent),
          memberCount,
          poolTotalUsd: Number((poolTotalUsd || 0).toFixed(4)),
          rewardPerMemberUsd: rewardPerMember,
          withdrawPerMemberUsd: split.withdrawAmount,
          reconsumptionPerMemberUsd: split.reconsumptionAmount,
          taxPerMemberUsd: split.taxAmount,
          payoutUsd: Number((rewardPerMember * memberCount).toFixed(4)),
          withdrawUsd: Number((split.withdrawAmount * memberCount).toFixed(4)),
          reconsumptionUsd: Number(
            (split.reconsumptionAmount * memberCount).toFixed(4),
          ),
        });
      }

      if (missing.length === 0) continue;

      if (rows.length >= limit) {
        truncated = true;
        break;
      }

      const orderAmountUsd = missing.reduce((acc, m) => acc + m.payoutUsd, 0);
      const orderWithdrawUsd = missing.reduce((acc, m) => acc + m.withdrawUsd, 0);
      const orderReconsumptionUsd = missing.reduce(
        (acc, m) => acc + m.reconsumptionUsd,
        0,
      );
      totalMissingPools += missing.length;
      totalAmountUsd += orderAmountUsd;
      totalWithdrawUsd += orderWithdrawUsd;
      totalReconsumptionUsd += orderReconsumptionUsd;

      rows.push({
        orderId: order.id,
        createdAt: order.createdAt,
        status: order.status,
        orderTotalAmount: Number(order.totalAmount) || 0,
        orderNetAmount: netAmount,
        missingPools: missing,
        missingPoolCodes: missing.map((m) => m.poolCode),
        estimatedPayoutUsd: Number(orderAmountUsd.toFixed(4)),
        estimatedWithdrawUsd: Number(orderWithdrawUsd.toFixed(4)),
        estimatedReconsumptionUsd: Number(orderReconsumptionUsd.toFixed(4)),
      });
    }

    return {
      distribution,
      payablePools: payablePools.map(({ pool, memberCount }) => ({
        poolId: pool.id,
        poolCode: pool.code,
        poolName: pool.name,
        poolPercent: Number(pool.percent),
        memberCount,
      })),
      skippedPools,
      orders: rows,
      totalOrders: rows.length,
      totalMissingPools,
      totalAmountUsd: Number(totalAmountUsd.toFixed(4)),
      totalWithdrawUsd: Number(totalWithdrawUsd.toFixed(4)),
      totalReconsumptionUsd: Number(totalReconsumptionUsd.toFixed(4)),
      truncated,
    };
  }

  /**
   * Chạy bù cho các đơn được chọn. processOrder là idempotent theo (đơn, bể)
   * nên bể đã chia rồi sẽ không bị cộng lần hai.
   */
  async runBackfill(dto: { orderIds: string[] }) {
    const orderIds = Array.from(new Set(dto?.orderIds || [])).filter(Boolean);
    if (orderIds.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất một đơn hàng để chạy bù',
      );
    }
    if (orderIds.length > 1000) {
      throw new BadRequestException('Mỗi lần chạy bù tối đa 1000 đơn hàng');
    }

    const orders = await this.orderRepo.find({ where: { id: In(orderIds) } });
    const orderMap = new Map(orders.map((o) => [o.id, o]));

    const results: Array<{
      orderId: string;
      status: 'done' | 'skipped' | 'failed';
      poolCodes: string[];
      payoutUsd: number;
      withdrawUsd?: number;
      reconsumptionUsd?: number;
      message?: string;
    }> = [];

    let totalPayoutUsd = 0;
    let totalWithdrawUsd = 0;
    let totalReconsumptionUsd = 0;

    for (const orderId of orderIds) {
      const order = orderMap.get(orderId);
      if (!order) {
        results.push({
          orderId,
          status: 'skipped',
          poolCodes: [],
          payoutUsd: 0,
          message: 'Không tìm thấy đơn hàng',
        });
        continue;
      }
      if (!AgentPoolService.BACKFILL_ORDER_STATUSES.includes(order.status)) {
        results.push({
          orderId,
          status: 'skipped',
          poolCodes: [],
          payoutUsd: 0,
          message: `Đơn ở trạng thái ${order.status}, không đủ điều kiện chia`,
        });
        continue;
      }

      const before = await this.historyRepo.find({ where: { orderId } });
      const beforeIds = new Set(before.map((h) => h.poolId));

      try {
        await this.processOrder(orderId);
      } catch (error: any) {
        results.push({
          orderId,
          status: 'failed',
          poolCodes: [],
          payoutUsd: 0,
          message: error?.message || 'Lỗi không xác định',
        });
        continue;
      }

      // Đối chiếu lịch sử trước/sau để báo đúng phần thực sự được bù.
      const after = await this.historyRepo.find({
        where: { orderId },
        relations: ['pool'],
      });
      const added = after.filter((h) => !beforeIds.has(h.poolId));
      const sumOf = (pick: (h: AgentPoolHistory) => number) =>
        Number(added.reduce((acc, h) => acc + (Number(pick(h)) || 0), 0).toFixed(4));

      const payoutUsd = sumOf((h) => h.rewardAmount);
      const withdrawUsd = sumOf((h) => h.withdrawAmount);
      const reconsumptionUsd = sumOf((h) => h.reconsumptionAmount);
      totalPayoutUsd += payoutUsd;
      totalWithdrawUsd += withdrawUsd;
      totalReconsumptionUsd += reconsumptionUsd;

      results.push({
        orderId,
        status: added.length > 0 ? 'done' : 'skipped',
        poolCodes: Array.from(
          new Set(added.map((h) => h.pool?.code).filter(Boolean) as string[]),
        ),
        payoutUsd,
        withdrawUsd,
        reconsumptionUsd,
        message: added.length > 0 ? undefined : 'Không có bể nào cần bù',
      });
    }

    const doneCount = results.filter((r) => r.status === 'done').length;
    this.logger.log(
      `Backfill agent pool: ${doneCount}/${orderIds.length} đơn được bù, tổng ${totalPayoutUsd.toFixed(4)} USD.`,
    );

    return {
      success: true,
      requested: orderIds.length,
      doneCount,
      skippedCount: results.filter((r) => r.status === 'skipped').length,
      failedCount: results.filter((r) => r.status === 'failed').length,
      totalPayoutUsd: Number(totalPayoutUsd.toFixed(4)),
      totalWithdrawUsd: Number(totalWithdrawUsd.toFixed(4)),
      totalReconsumptionUsd: Number(totalReconsumptionUsd.toFixed(4)),
      results,
    };
  }
}
