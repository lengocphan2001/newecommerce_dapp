import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import {
  Commission,
  CommissionStatus,
  CommissionType,
} from './entities/commission.entity';
import { User } from '../user/entities/user.entity';
import { CommissionPayoutService as BlockchainPayoutService } from '../blockchain/commission-payout.service';
import { BatchPayoutDto, PayoutRecipientDto } from './dto/batch-payout.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditLogAction,
  AuditLogEntityType,
} from '../audit-log/entities/audit-log.entity';
import { AdminService } from '../admin/admin.service';
import { roundMoney } from '../common/utils/number.util';

const COMMISSION_FEE_PERCENT = 12;

/**
 * Commission được trả ngay (không cần đạt ngưỡng): Direct từ package HOẶC Product direct (type=PRODUCT, notes bắt đầu "Product direct").
 */
function isPayImmediately(commission: Commission): boolean {
  if (
    commission.type === CommissionType.DIRECT ||
    commission.type === CommissionType.INDIRECT
  )
    return true;
  if (
    commission.type === CommissionType.PRODUCT &&
    commission.notes?.startsWith('Product direct')
  )
    return true;
  return false;
}

@Injectable()
export class CommissionPayoutService {
  private readonly logger = new Logger(CommissionPayoutService.name);

  constructor(
    @InjectRepository(Commission)
    private commissionRepository: Repository<Commission>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private blockchainPayoutService: BlockchainPayoutService,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  /**
   * Get pending commissions ready for payout
   * Returns all pending commissions (including those without walletAddress) so admin can see all
   */
  async getPendingCommissions(
    limit: number = 100,
    minAmount?: number,
  ): Promise<Commission[]> {
    const query = this.commissionRepository
      .createQueryBuilder('commission')
      .leftJoinAndSelect('commission.user', 'user')
      .where('commission.status IN (:...statuses)', {
        statuses: [CommissionStatus.PENDING, CommissionStatus.BLOCKED],
      })
      .orderBy('commission.createdAt', 'ASC')
      .limit(limit);

    if (minAmount) {
      query.andWhere('commission.amount >= :minAmount', { minAmount });
    }

    return await query.getMany();
  }

  /**
   * Group commissions by user wallet address
   */
  async groupCommissionsByWallet(
    commissions: Commission[],
  ): Promise<
    Map<string, { user: User; commissions: Commission[]; totalAmount: number }>
  > {
    const grouped = new Map<
      string,
      { user: User; commissions: Commission[]; totalAmount: number }
    >();

    for (const commission of commissions) {
      if (!commission.user?.id) {
        this.logger.warn(
          `Commission ${commission.id} has no user relation, skipping`,
        );
        continue;
      }

      const recipientKey = commission.user.id;
      const existing = grouped.get(recipientKey);

      if (existing) {
        existing.commissions.push(commission);
        existing.totalAmount += commission.amount;
      } else {
        grouped.set(recipientKey, {
          user: commission.user,
          commissions: [commission],
          totalAmount: commission.amount,
        });
      }
    }

    return grouped;
  }

  /**
   * Prepare payout batch from commissions
   */
  async preparePayoutBatch(
    commissions: Commission[],
  ): Promise<{ recipients: PayoutRecipientDto[]; commissionIds: string[] }> {
    const grouped = await this.groupCommissionsByWallet(commissions);
    const recipients: PayoutRecipientDto[] = [];
    const commissionIds: string[] = [];

    for (const [, data] of grouped.entries()) {
      const grossAmount = Number(data.totalAmount).toFixed(18);
      this.logger.debug(
        `Payout user ${data.user.id}: gross=${data.totalAmount} (internal wallet distribution applied at execute)`,
      );
      recipients.push({
        userId: data.user.id,
        walletAddress: (data.user.walletAddress || `internal:${data.user.id}`)
          .toLowerCase(),
        amount: grossAmount,
        commissionIds: data.commissions.map((c) => c.id),
      });

      commissionIds.push(...data.commissions.map((c) => c.id));
    }

    return { recipients, commissionIds };
  }

  /**
   * Execute batch payout
   */
  async executeBatchPayout(
    dto: BatchPayoutDto,
    userId?: string,
    username?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ batchId: string; txHash: string; success: boolean }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get specific commission IDs from recipients if available
      const specificCommissionIds = dto.recipients.flatMap(
        (r) => r.commissionIds || [],
      );

      let commissions: Commission[];
      if (specificCommissionIds.length > 0) {
        commissions = await this.commissionRepository.find({
          where: {
            id: In(specificCommissionIds),
            status: In([CommissionStatus.PENDING, CommissionStatus.BLOCKED]),
          },
          relations: ['user'],
        });
      } else {
        const userIds = dto.recipients.map((r) => r.userId);
        commissions = await this.commissionRepository.find({
          where: {
            userId: In(userIds),
            status: In([CommissionStatus.PENDING, CommissionStatus.BLOCKED]),
          },
          relations: ['user'],
        });
      }

      if (commissions.length === 0) {
        throw new Error(
          'No pending or blocked commissions found for the provided recipients',
        );
      }

      const { depositPercent: reconsumptionPercent, withdrawPercent } =
        await this.adminService.getCommissionWalletDistribution();
      const taxPercent = 100 - withdrawPercent - reconsumptionPercent;
      this.logger.log(
        `Internal payout distribution: withdraw=${withdrawPercent}%, reconsumption(tiêu dùng)=${reconsumptionPercent}%, tax(thuế)=${taxPercent}%`,
      );

      const batchId =
        dto.batchId ||
        this.blockchainPayoutService.generateBatchId(
          dto.recipients.map((r) => r.walletAddress),
          dto.recipients.map((r) => r.amount),
        );

      // Update commissions in database (only those that were actually paid)
      const commissionMap = new Map<string, Commission[]>();
      for (const commission of commissions) {
        if (!commission.userId) continue;
        if (!commissionMap.has(commission.userId)) {
          commissionMap.set(commission.userId, []);
        }
        commissionMap.get(commission.userId)!.push(commission);
      }

      // Update each commission and credit withdraw wallet and reconsumption wallet
      const recipientUserIds = dto.recipients.map((recipient) => recipient.userId);
      const recipientsUsers = recipientUserIds.length
        ? await queryRunner.manager.find(User, {
            where: { id: In(recipientUserIds) },
            select: ['id', 'withdrawWalletBalance', 'reconsumptionWalletBalance'],
          })
        : [];
      const usersById = new Map(recipientsUsers.map((user) => [user.id, user]));

      for (const recipient of dto.recipients) {
        const userCommissions = commissionMap.get(recipient.userId) || [];
        const user = usersById.get(recipient.userId);
        if (!user) continue;

        const gross = userCommissions.reduce(
          (sum, c) => sum + Number(c.amount || 0),
          0,
        );
        const withdrawAmount = roundMoney((gross * withdrawPercent) / 100);
        const reconsumptionAmount = roundMoney((gross * reconsumptionPercent) / 100);
        
        const currentWithdraw = Number(user.withdrawWalletBalance || 0);
        const currentReconsumption = Number(user.reconsumptionWalletBalance || 0);
        
        await queryRunner.manager.update(User, user.id, {
          withdrawWalletBalance: currentWithdraw + withdrawAmount,
          reconsumptionWalletBalance: currentReconsumption + reconsumptionAmount,
        });

        for (const commission of userCommissions) {
          commission.status = CommissionStatus.PAID;
          commission.payoutBatchId = batchId;
          commission.payoutTxHash = null as any;
          commission.payoutBlockNumber = null as any;
          commission.payoutDate = new Date();
          const parts = [
            commission.notes,
            `Distributed: withdraw wallet (${withdrawPercent}%), reconsumption wallet (${reconsumptionPercent}%), tax (${taxPercent}%)`,
          ]
            .filter(Boolean)
            .join('; ');
          commission.notes = parts || commission.notes;

          await queryRunner.manager.save(Commission, commission);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Batch payout successful. BatchId: ${batchId}, Commissions: ${commissions.length}`,
      );

      // Log successful payout
      await this.auditLogService.create(
        {
          action: AuditLogAction.PAYOUT_EXECUTED,
          entityType: AuditLogEntityType.COMMISSION_PAYOUT,
          entityId: batchId,
          description: `Batch payout distributed to internal wallets. ${commissions.length} commissions paid`,
          metadata: {
            batchId,
            txHash: null,
            blockNumber: null,
            gasUsed: null,
            commissionCount: commissions.length,
            recipientCount: dto.recipients.length,
            distribution: {
              withdrawPercent,
              reconsumptionPercent,
              taxPercent,
            },
            totalAmount: dto.recipients.reduce(
              (sum, r) => sum + parseFloat(r.amount),
              0,
            ),
          },
        },
        userId,
        username,
        ipAddress,
        userAgent,
      );

      return {
        batchId,
        txHash: '',
        success: true,
      };
    } catch (error: any) {
      await queryRunner.rollbackTransaction();
      const errMsg = error?.message || String(error);
      this.logger.error(`Batch payout failed: ${errMsg}`, error?.stack);

      // Log failed payout
      const batchId = dto.batchId || 'unknown';
      await this.auditLogService.create(
        {
          action: AuditLogAction.PAYOUT_FAILED,
          entityType: AuditLogEntityType.COMMISSION_PAYOUT,
          entityId: batchId,
          description: `Batch payout failed: ${errMsg}`,
          metadata: {
            batchId,
            error: errMsg,
            stack: error?.stack,
            recipientCount: dto.recipients.length,
          },
        },
        userId,
        username,
        ipAddress,
        userAgent,
      );

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Payout specific commissions by ID (e.g. when admin approves on Commissions page).
   * Loads PENDING commissions, groups by wallet, executes blockchain payout, marks PAID.
   */
  async payoutCommissionsByIds(
    commissionIds: string[],
    userId?: string,
    username?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    batchId: string;
    txHash: string;
    success: boolean;
    count: number;
  }> {
    if (commissionIds.length === 0) {
      throw new Error('No commission IDs provided');
    }

    const commissions = await this.commissionRepository.find({
      where: { id: In(commissionIds), status: In([CommissionStatus.PENDING, CommissionStatus.BLOCKED]) },
      relations: ['user'],
    });

    if (commissions.length === 0) {
      throw new Error('No pending or blocked commissions found for the given IDs');
    }

    const { recipients } = await this.preparePayoutBatch(commissions);
    const result = await this.executeBatchPayout(
      { recipients },
      userId,
      username,
      ipAddress,
      userAgent,
    );
    return { ...result, count: commissions.length };
  }

  /**
   * Single payout for one user (used for milestone rewards)
   * Finds the specific commission by orderId (milestone-{milestoneId}) and pays it
   */
  async singlePayout(
    userId: string,
    walletAddress: string,
    amount: number,
    orderId?: string, // Optional: specific orderId to find commission (e.g., milestone-{id})
  ): Promise<{ batchId: string; txHash: string; success: boolean }> {
    let commissionIds: string[] = [];

    // If orderId is provided, find the specific commission (or milestone by milestoneRef)
    if (orderId) {
      const isMilestone = orderId.startsWith('milestone-');
      const where: any = { userId, status: CommissionStatus.PENDING };
      if (isMilestone) {
        where.milestoneRef = orderId;
        where.type = CommissionType.MILESTONE;
      } else {
        where.orderId = orderId;
      }
      const commission = await this.commissionRepository.findOne({
        where,
        relations: ['user'],
      });

      if (!commission) {
        throw new Error(
          `No pending commission found for ${isMilestone ? 'milestoneRef' : 'orderId'}: ${orderId}`,
        );
      }

      // Verify amount matches
      if (Math.abs(commission.amount - amount) > 0.01) {
        throw new Error(
          `Amount mismatch. Commission amount: ${commission.amount}, Provided: ${amount}`,
        );
      }
      commissionIds = [commission.id];
    }

    const dto: BatchPayoutDto = {
      recipients: [
        {
          userId,
          walletAddress,
          amount: Number(amount).toFixed(18),
          commissionIds: commissionIds.length > 0 ? commissionIds : undefined,
        },
      ],
    };

    return this.executeBatchPayout(dto);
  }

  /**
   * Auto payout pending commissions
   */
  async autoPayout(
    batchSize: number = 50,
    minAmount?: number,
  ): Promise<{ batchId: string; txHash: string; count: number }> {
    this.logger.log(`Starting auto payout. Batch size: ${batchSize}`);

    // Get pending commissions
    const pendingCommissions = await this.getPendingCommissions(
      batchSize,
      minAmount,
    );

    if (pendingCommissions.length === 0) {
      this.logger.log('No pending commissions to payout');
      return { batchId: '', txHash: '', count: 0 };
    }

    // Log auto payout start
    await this.auditLogService.create(
      {
        action: AuditLogAction.PAYOUT_CREATED,
        entityType: AuditLogEntityType.COMMISSION_PAYOUT,
        description: `Auto payout started. Batch size: ${batchSize}, Min amount: ${minAmount || 'none'}`,
        metadata: {
          batchSize,
          minAmount,
          trigger: 'scheduled',
        },
      },
      'system',
      'system',
      undefined,
      undefined,
    );

    // Log auto payout execution
    try {
      // Prepare batch
      const { recipients, commissionIds } =
        await this.preparePayoutBatch(pendingCommissions);

      if (recipients.length === 0) {
        this.logger.warn('No valid recipients found');
        return { batchId: '', txHash: '', count: 0 };
      }

      // Execute payout
      const dto: BatchPayoutDto = {
        recipients,
      };

      const result = await this.executeBatchPayout(
        dto,
        'system',
        'system',
        undefined,
        undefined,
      );

      return {
        batchId: result.batchId,
        txHash: result.txHash,
        count: commissionIds.length,
      };
    } catch (error: any) {
      // Log auto payout failure
      await this.auditLogService.create(
        {
          action: AuditLogAction.PAYOUT_FAILED,
          entityType: AuditLogEntityType.COMMISSION_PAYOUT,
          description: `Auto payout failed: ${error.message}`,
          metadata: {
            error: error.message,
            batchSize,
            minAmount,
            trigger: 'scheduled',
          },
        },
        'system',
        'system',
        undefined,
        undefined,
      );
      throw error;
    }
  }

  /**
   * Check a single user's PENDING commissions.
   * - DIRECT: always pay immediately (no threshold).
   * - GROUP and others: pay only when total non-direct pending >= minPayoutThreshold.
   */
  async checkAndPayoutUser(
    userId: string,
    minThreshold: number,
  ): Promise<void> {
    const pendingCommissions = await this.commissionRepository.find({
      where: { userId, status: CommissionStatus.PENDING },
      relations: ['user'],
    });

    if (pendingCommissions.length === 0) return;

    const directPending = pendingCommissions.filter((c) => isPayImmediately(c));
    const nonDirectPending = pendingCommissions.filter(
      (c) => !isPayImmediately(c),
    );

    // 1) Pay all direct (package DIRECT + product direct) immediately (no threshold)
    if (directPending.length > 0) {
      if (directPending.length > 0) {
        const totalDirect = directPending.reduce(
          (sum, c) => sum + Number(c.amount),
          0,
        );
        this.logger.log(
          `[THRESHOLD PAYOUT] User ${userId}: paying ${directPending.length} direct commissions (total: ${totalDirect}) immediately`,
        );
        try {
          const { recipients } = await this.preparePayoutBatch(directPending);
          if (recipients.length > 0) {
            await this.executeBatchPayout(
              { recipients },
              'system',
              'system',
              undefined,
              undefined,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `[THRESHOLD PAYOUT] Direct payout failed for user ${userId}: ${error.message}`,
            error.stack,
          );
        }
      }
    }

    // 2) Non-direct (group, product, management): pay only when total >= threshold
    if (nonDirectPending.length === 0) return;

    const totalNonDirect = nonDirectPending.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );
    this.logger.log(
      `[THRESHOLD PAYOUT] User ${userId}: non-direct pending=${totalNonDirect}, threshold=${minThreshold}`,
    );

    if (totalNonDirect < minThreshold) {
      this.logger.debug(
        `[THRESHOLD PAYOUT] User ${userId} has not reached threshold. Group/other will accumulate.`,
      );
      return;
    }

    this.logger.log(
      `[THRESHOLD PAYOUT] User ${userId} reached threshold. Paying ${nonDirectPending.length} non-direct commissions (total: ${totalNonDirect})`,
    );
    try {
      const { recipients } = await this.preparePayoutBatch(nonDirectPending);
      if (recipients.length === 0) return;
      await this.executeBatchPayout(
        { recipients },
        'system',
        'system',
        undefined,
        undefined,
      );
    } catch (error: any) {
      this.logger.error(
        `[THRESHOLD PAYOUT] Group payout failed for user ${userId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Payout commissions for a specific order.
   * - DIRECT commission: paid immediately (no threshold).
   * - GROUP (and other types): accumulated; pay only when user's total pending >= minPayoutThreshold.
   */
  async payoutOrderCommissions(
    orderId: string,
  ): Promise<{ count: number } | null> {
    this.logger.log(`[PAYOUT] Processing payout after order: ${orderId}`);

    const orderCommissions = await this.commissionRepository.find({
      where: { orderId, status: CommissionStatus.PENDING },
      relations: ['user'],
    });

    if (orderCommissions.length === 0) {
      this.logger.warn(`[PAYOUT] No pending commissions for order ${orderId}`);
      return null;
    }

    const minThreshold = await this.adminService.getMinPayoutThreshold();
    this.logger.log(
      `[PAYOUT] Min payout threshold (for group/other): $${minThreshold}`,
    );

    // 1) Pay direct commissions (package DIRECT + product direct) from this order immediately (no accumulation)
    const directCommissions = orderCommissions.filter((c) =>
      isPayImmediately(c),
    );
    if (directCommissions.length > 0) {
      const { recipients } = await this.preparePayoutBatch(directCommissions);
      if (recipients.length > 0) {
        try {
          await this.executeBatchPayout(
            { recipients },
            'system',
            'system',
            undefined,
            undefined,
          );
          this.logger.log(
            `[PAYOUT] Paid direct commissions for order ${orderId}: ${recipients.length} users`,
          );
        } catch (err: any) {
          this.logger.error(
            `[PAYOUT] Direct payout failed for order ${orderId}: ${err.message}`,
            err.stack,
          );
        }
      }
    }

    // 2) For GROUP (and other non-direct): accumulate; pay when total pending >= threshold
    const affectedUserIds = [...new Set(orderCommissions.map((c) => c.userId))];
    let payoutCount = 0;
    for (const userId of affectedUserIds) {
      await this.checkAndPayoutUser(userId, minThreshold);
      payoutCount++;
    }

    return { count: payoutCount };
  }

  /**
   * Get payout statistics
   */
  async getPayoutStats() {
    const [totalPending, totalPaid, totalBlocked, totalAmount] =
      await Promise.all([
        this.commissionRepository.count({
          where: { status: CommissionStatus.PENDING },
        }),
        this.commissionRepository.count({
          where: { status: CommissionStatus.PAID },
        }),
        this.commissionRepository.count({
          where: { status: CommissionStatus.BLOCKED },
        }),
        this.commissionRepository
          .createQueryBuilder('commission')
          .select('SUM(commission.amount)', 'total')
          .where('commission.status = :status', {
            status: CommissionStatus.PENDING,
          })
          .getRawOne(),
      ]);

    const contractBalance =
      await this.blockchainPayoutService.getContractBalance();
    const contractInfo = await this.blockchainPayoutService.getContractInfo();

    return {
      pending: {
        count: totalPending,
        totalAmount: totalAmount?.total || 0,
      },
      paid: {
        count: totalPaid,
      },
      blocked: {
        count: totalBlocked,
      },
      contractBalance: parseFloat(contractBalance),
      contractAddress: contractInfo.contractAddress,
      tokenAddress: contractInfo.tokenAddress,
    };
  }

}
