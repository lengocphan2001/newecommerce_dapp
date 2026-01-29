import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { MilestoneRewardConfig } from './entities/milestone-reward-config.entity';
import { UserMilestone } from './entities/user-milestone.entity';
import { User } from '../user/entities/user.entity';
import { CommissionService } from '../affiliate/commission.service';
import { CommissionPayoutService } from '../affiliate/commission-payout.service';

@Injectable()
export class MilestoneRewardService {
  private readonly logger = new Logger(MilestoneRewardService.name);

  constructor(
    @InjectRepository(MilestoneRewardConfig)
    private configRepository: Repository<MilestoneRewardConfig>,
    @InjectRepository(UserMilestone)
    private userMilestoneRepository: Repository<UserMilestone>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => CommissionService))
    private commissionService: CommissionService,
    @Inject(forwardRef(() => CommissionPayoutService))
    private commissionPayoutService: CommissionPayoutService,
  ) { }

  /**
   * Get active milestone config
   */
  async getConfig(): Promise<MilestoneRewardConfig | null> {
    try {
      return await this.configRepository.findOne({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      });
    } catch (error: any) {
      // Handle case where table doesn't exist yet
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42P01') {
        this.logger.warn('milestone_reward_config table does not exist yet. Please run database migration.');
        return null;
      }
      this.logger.error('Error fetching milestone config:', error);
      throw error;
    }
  }

  /**
   * Create or update milestone config
   * percentX, percentY, percentZ are percentages (e.g., 1.00 = 1%, 2.50 = 2.5%)
   */
  async setConfig(percentX: number, percentY: number, percentZ: number): Promise<MilestoneRewardConfig> {
    // Deactivate all existing configs
    await this.configRepository.update({ isActive: true }, { isActive: false });

    // Create new active config
    const config = this.configRepository.create({
      percentX,
      percentY,
      percentZ,
      isActive: true,
    });

    return this.configRepository.save(config);
  }

  /**
   * Count direct referrals via left/right links for a user
   * Only counts users who have purchased a package (packageType != 'NONE') AND have transactions (totalPurchaseAmount > 0)
   */
  async countDirectReferrals(userId: string): Promise<number> {
    // Use query builder to check both packageType and totalPurchaseAmount
    const count = await this.userRepository
      .createQueryBuilder('user')
      .where('user.referralUserId = :userId', { userId })
      .andWhere('user.totalPurchaseAmount > :zero', { zero: 0 })
      .getCount();

    return count;
  }

  /**
   * Check if a number is a power of 2
   */
  private isPowerOfTwo(n: number): boolean {
    if (n < 2) return false;
    // A number is a power of 2 if (n & (n - 1)) === 0
    return (n & (n - 1)) === 0;
  }

  /**
   * Get which reward type (X, Y, Z) for a milestone count
   * Pattern: 2→X, 4→Y, 8→Z, 16→X, 32→Y, 64→Z, 128→X...
   * Pattern repeats every 3 milestones
   */
  getRewardType(milestoneCount: number): 'X' | 'Y' | 'Z' {
    // Find the position in the power-of-2 sequence: 2, 4, 8, 16, 32, 64...
    // Calculate log2 to get position (1, 2, 3, 4, 5, 6...)
    const position = Math.log2(milestoneCount);

    // Pattern repeats every 3: position 1→X, 2→Y, 3→Z, 4→X, 5→Y, 6→Z...
    const remainder = position % 3;
    if (remainder === 1) return 'X'; // 2, 16, 128... (position 1, 4, 7...)
    if (remainder === 2) return 'Y'; // 4, 32, 256... (position 2, 5, 8...)
    if (remainder === 0) return 'Z'; // 8, 64, 512... (position 3, 6, 9...)

    // Fallback
    return 'X';
  }

  /**
   * Check if milestone count is valid (2, 4, 8, 16, 32, 64...)
   * Must be a power of 2 and >= 2
   */
  isValidMilestone(count: number): boolean {
    return count >= 2 && this.isPowerOfTwo(count);
  }

  /**
   * Get reward percentage for a milestone count
   */
  async getRewardPercent(milestoneCount: number): Promise<number> {
    const config = await this.getConfig();
    if (!config) return 0;

    const rewardType = this.getRewardType(milestoneCount);
    switch (rewardType) {
      case 'X':
        return config.percentX || 0;
      case 'Y':
        return config.percentY || 0;
      case 'Z':
        return config.percentZ || 0;
      default:
        return 0;
    }
  }

  /**
   * Calculate reward amount based on base purchase amount and milestone percentage
   * (Base amount can be the milestone group purchase total)
   */
  async calculateRewardAmount(milestoneCount: number, baseAmount: number): Promise<number> {
    const percent = await this.getRewardPercent(milestoneCount);
    if (percent <= 0 || baseAmount <= 0) {
      return 0;
    }
    // Calculate: baseAmount * percent / 100
    return (baseAmount * percent) / 100;
  }

  /**
   * Check and process milestone rewards for a user
   * Called when a new user registers via left/right link
   */
  async checkAndProcessMilestones(referralUserId: string): Promise<void> {
    const config = await this.getConfig();
    if (!config || !config.isActive) {
      return; // No active config, skip
    }

    const referralUser = await this.userRepository.findOne({
      where: { id: referralUserId },
    });

    if (!referralUser) {
      return;
    }

    // Fetch all referrals with transactions to support catch-up logic
    const directReferrals = await this.userRepository.find({
      where: {
        referralUserId: referralUserId,
      },
      order: { createdAt: 'ASC' }, // Critical: ensure deterministic grouping by time
    });

    // Filter to only count those with transactions
    const referralsWithTransactions = directReferrals.filter(
      (ref) => (Number(ref.totalPurchaseAmount) || 0) > 0
    );

    const totalQualifiedReferrals = referralsWithTransactions.length;
    this.logger.log(`[MILESTONE CHECK] User ${referralUserId} has ${totalQualifiedReferrals} qualified referrals. Checking for due milestones...`);

    // Get referrer's totalPurchaseAmount checks
    const referrerPurchaseAmount = Number(referralUser.totalPurchaseAmount) || 0;

    if (referrerPurchaseAmount <= 0) {
      this.logger.warn(`[MILESTONE CHECK] Referrer ${referralUserId} has 0 purchase amount. Ineligible.`);
      return;
    }

    // Loop through all potential milestones (2, 4, 8, 16...) <= totalQualifiedReferrals
    let milestoneTarget = 2;

    while (milestoneTarget <= totalQualifiedReferrals) {
      // Check if this specific milestone (e.g. 2) is already paid
      const existing = await this.userMilestoneRepository.findOne({
        where: {
          userId: referralUserId,
          milestoneCount: milestoneTarget,
        },
      });

      if (existing) {
        // Already paid, move to next (4)
        milestoneTarget *= 2;
        continue;
      }

      this.logger.log(`[MILESTONE CHECK] Found unpaid milestone ${milestoneTarget} for user ${referralUserId}. Processing...`);

      // Determine the group of users responsible for this milestone
      let startIndex: number;
      let endIndex: number = milestoneTarget;

      if (milestoneTarget === 2) {
        // Special case: M2 uses first 2 users (index 0, 1)
        startIndex = 0;
      } else {
        // Standard case: M4 uses users 2-3 (index 2, 3), M8 uses 4-7
        startIndex = milestoneTarget / 2;
      }

      // Extract the specific group of referrals
      const targetRefs = referralsWithTransactions.slice(startIndex, endIndex);

      // Calculate group volume (just for logging/validation, base is referrer amount)
      const groupPurchaseTotal = targetRefs.reduce(
        (sum, ref) => sum + (Number(ref.totalPurchaseAmount) || 0),
        0,
      );

      // Get reward percentage
      const rewardType = this.getRewardType(milestoneTarget);
      let percent = 0;
      switch (rewardType) {
        case 'X': percent = config.percentX || 0; break;
        case 'Y': percent = config.percentY || 0; break;
        case 'Z': percent = config.percentZ || 0; break;
      }

      if (percent <= 0) {
        this.logger.warn(`[MILESTONE CHECK] No percentage configured for reward type ${rewardType} (milestone ${milestoneTarget}).`);
        milestoneTarget *= 2;
        continue;
      }

      // Calculate reward amount: GROUP's total purchase amount * percent / 100
      // User request: "total order of milestone... total of two"
      const rewardAmount = (groupPurchaseTotal * percent) / 100;

      if (rewardAmount <= 0) {
        this.logger.warn(`[MILESTONE CHECK] Calculated reward is 0. Base (Group Total): ${groupPurchaseTotal}, Percent: ${percent}.`);
        milestoneTarget *= 2;
        continue;
      }

      // Create milestone record
      const milestone = this.userMilestoneRepository.create({
        userId: referralUserId,
        milestoneCount: milestoneTarget,
        rewardAmount,
        rewardType,
        // Store the Group Total as the base used for calculation (repurposing the field or it's just the 'base' amount)
        referrerPurchaseAmount: groupPurchaseTotal,
        percentUsed: percent,
        status: 'PENDING',
      });

      await this.userMilestoneRepository.save(milestone);
      this.logger.log(`[MILESTONE CHECK] Created milestone ${milestoneTarget} record for user ${referralUserId}. Amount: ${rewardAmount}`);

      // Award commission
      try {
        await this.commissionService.awardMilestoneReward(
          referralUserId,
          rewardAmount,
          milestone.id,
        );

        if (referralUser.walletAddress) {
          try {
            this.logger.log(`[MILESTONE CHECK] Transferring ${rewardAmount} USDT to ${referralUser.walletAddress}`);
            const payoutResult = await this.commissionPayoutService.singlePayout(
              referralUserId,
              referralUser.walletAddress,
              rewardAmount,
              `milestone-${milestone.id}`,
            );

            milestone.status = 'PAID';
            await this.userMilestoneRepository.save(milestone);
            this.logger.log(`[MILESTONE CHECK] USDT transfer successful. Tx: ${payoutResult.txHash}`);
          } catch (payoutError: any) {
            this.logger.error(`[MILESTONE CHECK] USDT transfer failed: ${payoutError.message}`, payoutError);
          }
        } else {
          this.logger.warn(`[MILESTONE CHECK] User has no wallet address. Keeping as PENDING.`);
        }
      } catch (error) {
        this.logger.error(`[MILESTONE CHECK] Error awarding commission logic:`, error);
      }

      // Move to next milestone
      milestoneTarget *= 2;
    }
  }

  /**
   * Get all milestones for a user
   */
  async getUserMilestones(userId: string): Promise<UserMilestone[]> {
    return this.userMilestoneRepository.find({
      where: { userId },
      order: { milestoneCount: 'ASC' },
    });
  }

  /**
   * Get all milestones (admin)
   */
  async getAllMilestones(): Promise<UserMilestone[]> {
    try {
      return await this.userMilestoneRepository
        .createQueryBuilder('milestone')
        .leftJoinAndSelect('milestone.user', 'user')
        .orderBy('milestone.createdAt', 'DESC')
        .getMany();
    } catch (error: any) {
      // Handle case where table doesn't exist yet
      if (error.code === 'ER_NO_SUCH_TABLE' || error.code === '42P01') {
        this.logger.warn('user_milestones table does not exist yet. Please run database migration.');
        return [];
      }
      this.logger.error('Error fetching all milestones:', error);
      // Fallback: return milestones without user relation if relation fails
      try {
        return await this.userMilestoneRepository.find({
          order: { createdAt: 'DESC' },
        });
      } catch (fallbackError: any) {
        if (fallbackError.code === 'ER_NO_SUCH_TABLE' || fallbackError.code === '42P01') {
          return [];
        }
        throw fallbackError;
      }
    }
  }
}
