import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RankPoolPlacement, UserRank } from './entities/rank-pool-placement.entity';
import { RankPoolHistory } from './entities/rank-pool-history.entity';
import { User } from '../user/entities/user.entity';
import { SystemConfig } from '../admin/entities/system-config.entity';

const ALL_RANKS = [UserRank.LEADER, UserRank.MANAGER, UserRank.DIRECTOR, UserRank.DIAMOND];

@Injectable()
export class RankPoolService {
  constructor(
    @InjectRepository(RankPoolPlacement)
    private placementRepo: Repository<RankPoolPlacement>,
    @InjectRepository(RankPoolHistory)
    private historyRepo: Repository<RankPoolHistory>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
  ) {}

  private async getConfigValue(key: string, defaultValue: number): Promise<number> {
    const row = await this.configRepo.findOne({ where: { key } });
    const parsed = parseFloat(row?.value ?? '');
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  // ── Placements ──────────────────────────────────────────────────────────────

  async addUser(userId: string, rank: UserRank, note?: string): Promise<RankPoolPlacement> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Mua 1 gói tặng thêm ID nhận thưởng đồng chia -> Cho phép nhiều placement active cho cùng user trong 1 bể rank
    // const existing = await this.placementRepo.findOne({
    //   where: { userId, rank, isActive: true },
    // });
    // if (existing) throw new BadRequestException('User đã có trong bể rank này và đang active');

    const placement = this.placementRepo.create({ userId, rank, totalRewarded: 0, isActive: true, note });
    const saved = await this.placementRepo.save(placement);

    // Đồng bộ rank trên User
    await this.userRepo.update(userId, { rank });
    return saved;
  }

  async removeUser(placementId: string): Promise<void> {
    const p = await this.placementRepo.findOne({ where: { id: placementId } });
    if (!p) throw new NotFoundException('Placement not found');
    await this.placementRepo.remove(p);
  }

  async toggleActive(placementId: string): Promise<RankPoolPlacement> {
    const p = await this.placementRepo.findOne({ where: { id: placementId } });
    if (!p) throw new NotFoundException('Placement not found');
    p.isActive = !p.isActive;
    return this.placementRepo.save(p);
  }

  async getPlacements(query: { rank?: UserRank; isActive?: string; limit?: string }) {
    const qb = this.placementRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .orderBy('p.createdAt', 'DESC');

    if (query.rank) qb.andWhere('p.rank = :rank', { rank: query.rank });
    if (query.isActive !== undefined) {
      qb.andWhere('p.isActive = :a', { a: query.isActive === 'true' });
    }
    const limit = Math.min(Number(query.limit) || 200, 500);
    qb.take(limit);
    return qb.getMany();
  }

  async getHistories(query: { rank?: UserRank; limit?: string }) {
    const qb = this.historyRepo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.user', 'user')
      .orderBy('h.createdAt', 'DESC');

    if (query.rank) qb.andWhere('h.rank = :rank', { rank: query.rank });
    const limit = Math.min(Number(query.limit) || 200, 500);
    qb.take(limit);
    return qb.getMany();
  }

  // ── Config ───────────────────────────────────────────────────────────────────

  async getConfig(): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const rank of ALL_RANKS) {
      result[`RANK_POOL_PERCENT_${rank}`] = await this.getConfigValue(`RANK_POOL_PERCENT_${rank}`, 5);
    }
    return result;
  }

  async updateConfig(dto: Record<string, number>): Promise<Record<string, number>> {
    for (const [key, value] of Object.entries(dto)) {
      if (!key.startsWith('RANK_POOL_PERCENT_')) continue;
      if (!Number.isFinite(value) || value < 0 || value > 100)
        throw new BadRequestException(`Giá trị không hợp lệ: ${key}=${value}`);
      let row = await this.configRepo.findOne({ where: { key } });
      if (!row) row = this.configRepo.create({ key, value: String(value) });
      else row.value = String(value);
      await this.configRepo.save(row);
    }
    return this.getConfig();
  }

  // ── Set user rank (standalone, without pool) ─────────────────────────────────

  async setUserRank(userId: string, rank: 'NONE' | UserRank): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.update(userId, { rank: rank as any });
    return { ...user, rank: rank as any };
  }

  // ── Distribute ────────────────────────────────────────────────────────────────

  /**
   * Chia thưởng thủ công cho bể rank chỉ định.
   * amount = tổng quỹ chia, chia đều cho tất cả active placement trong bể.
   */
  async distribute(rank: UserRank, totalAmount: number, note?: string): Promise<{
    distributed: number;
    perUser: number;
    recipients: number;
  }> {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0)
      throw new BadRequestException('Số tiền phải lớn hơn 0');

    const placements = await this.placementRepo.find({
      where: { rank, isActive: true },
    });
    if (placements.length === 0)
      throw new BadRequestException(`Không có thành viên active trong bể ${rank}`);

    const perUser = Math.round((totalAmount / placements.length) * 10000) / 10000;

    for (const p of placements) {
      await this.userRepo.increment({ id: p.userId }, 'withdrawWalletBalance', perUser);

      const hist = this.historyRepo.create({
        userId: p.userId,
        rank,
        amount: perUser,
        note: note || `Rank pool distribution: ${rank}`,
      });
      await this.historyRepo.save(hist);

      p.totalRewarded = (p.totalRewarded || 0) + perUser;
      await this.placementRepo.save(p);
    }

    return { distributed: perUser * placements.length, perUser, recipients: placements.length };
  }
}
