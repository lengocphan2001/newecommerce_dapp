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
  ) {}

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
   */
  async setConfig(rewardX: number, rewardY: number, rewardZ: number): Promise<MilestoneRewardConfig> {
    // Deactivate all existing configs
    await this.configRepository.update({ isActive: true }, { isActive: false });

    // Create new active config
    const config = this.configRepository.create({
      rewardX,
      rewardY,
      rewardZ,
      isActive: true,
    });

    return this.configRepository.save(config);
  }

  /**
   * Count direct referrals via left/right links for a user
   * Only counts users who have purchased a package (packageType != 'NONE')
   */
  async countDirectReferrals(userId: string): Promise<number> {
    return this.userRepository.count({
      where: { 
        referralUserId: userId,
        packageType: Not('NONE' as any), // Only count users who have purchased a package
      },
    });
  }

  /**
   * Get which reward type (X, Y, Z) for a milestone count
   * Pattern: 2→X, 4→Y, 6→Z, 8→X, 10→Y, 12→Z, 14→X, 16→Y, 18→Z...
   */
  getRewardType(milestoneCount: number): 'X' | 'Y' | 'Z' {
    // Pattern repeats every 6: 2→X, 4→Y, 6→Z, 8→X, 10→Y, 12→Z...
    const remainder = milestoneCount % 6;
    if (remainder === 2) return 'X'; // 2, 8, 14, 20...
    if (remainder === 4) return 'Y'; // 4, 10, 16, 22...
    if (remainder === 0) return 'Z'; // 6, 12, 18, 24...
    // Should not happen for valid milestones (2, 4, 6, 8, 10, 12...)
    return 'X'; // fallback
  }

  /**
   * Check if milestone count is valid (2, 4, 6, 8, 10, 12...)
   */
  isValidMilestone(count: number): boolean {
    // Must be even and >= 2
    return count >= 2 && count % 2 === 0;
  }

  /**
   * Get reward amount for a milestone count
   */
  async getRewardAmount(milestoneCount: number): Promise<number> {
    const config = await this.getConfig();
    if (!config) return 0;

    const rewardType = this.getRewardType(milestoneCount);
    switch (rewardType) {
      case 'X':
        return config.rewardX;
      case 'Y':
        return config.rewardY;
      case 'Z':
        return config.rewardZ;
      default:
        return 0;
    }
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

    // Count current referrals
    const currentCount = await this.countDirectReferrals(referralUserId);

    // Check if this is a milestone (2, 4, 6, 8, 10, 12...)
    if (!this.isValidMilestone(currentCount)) {
      return; // Not a milestone
    }

    // Check if this milestone was already claimed
    const existing = await this.userMilestoneRepository.findOne({
      where: {
        userId: referralUserId,
        milestoneCount: currentCount,
      },
    });

    if (existing) {
      return; // Already claimed
    }

    // Get reward amount
    const rewardType = this.getRewardType(currentCount);
    let rewardAmount = 0;
    switch (rewardType) {
      case 'X':
        rewardAmount = config.rewardX;
        break;
      case 'Y':
        rewardAmount = config.rewardY;
        break;
      case 'Z':
        rewardAmount = config.rewardZ;
        break;
    }

    if (rewardAmount <= 0) {
      return; // No reward configured
    }

    // Create milestone record
    const milestone = this.userMilestoneRepository.create({
      userId: referralUserId,
      milestoneCount: currentCount,
      rewardAmount,
      rewardType,
      status: 'PENDING', // Will be updated to PAID after commission is awarded
    });

    await this.userMilestoneRepository.save(milestone);

    // Award commission to user (will transfer USDT automatically)
    try {
      // Create commission record (status: PENDING)
      await this.commissionService.awardMilestoneReward(
        referralUserId,
        rewardAmount,
        milestone.id,
      );
      
      // Automatically transfer USDT to user's wallet if wallet address exists
      if (referralUser.walletAddress) {
        try {
          this.logger.log(
            `Transferring milestone reward ${rewardAmount} USDT to user ${referralUserId} (${referralUser.walletAddress})`,
          );
          const payoutResult = await this.commissionPayoutService.singlePayout(
            referralUserId,
            referralUser.walletAddress,
            rewardAmount,
            `milestone-${milestone.id}`, // Specify orderId to find the correct commission
          );
          this.logger.log(
            `Milestone reward USDT transfer successful. BatchId: ${payoutResult.batchId}, TxHash: ${payoutResult.txHash}`,
          );
          
          // Mark milestone as PAID after successful USDT transfer
          milestone.status = 'PAID';
          await this.userMilestoneRepository.save(milestone);
        } catch (payoutError: any) {
          // Log error but don't fail milestone award
          // Commission record is already created with PENDING status
          // USDT transfer can be retried later via admin panel
          this.logger.error(
            `Failed to transfer USDT for milestone reward: ${payoutError.message}. Commission remains PENDING and can be retried.`,
            payoutError,
          );
          // Keep milestone as PENDING if USDT transfer fails
          milestone.status = 'PENDING';
          await this.userMilestoneRepository.save(milestone);
        }
      } else {
        this.logger.warn(
          `User ${referralUserId} has no wallet address, skipping USDT transfer for milestone reward. Commission remains PENDING.`,
        );
        // Keep milestone as PENDING if no wallet address
        milestone.status = 'PENDING';
        await this.userMilestoneRepository.save(milestone);
      }
    } catch (error) {
      this.logger.error('Error awarding milestone reward:', error);
      // Keep as PENDING if commission service fails (can retry later)
      milestone.status = 'PENDING';
      await this.userMilestoneRepository.save(milestone);
      throw error; // Re-throw to allow retry
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
