import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Commission, CommissionStatus } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';
import { CommissionPayoutService as BlockchainPayoutService } from '../blockchain/commission-payout.service';
import { BatchPayoutDto, PayoutRecipientDto } from './dto/batch-payout.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditLogAction, AuditLogEntityType } from '../audit-log/entities/audit-log.entity';
import { AdminService } from '../admin/admin.service';

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
  ) { }

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
      .where('commission.status = :status', { status: CommissionStatus.PENDING })
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
  ): Promise<Map<string, { user: User; commissions: Commission[]; totalAmount: number }>> {
    const grouped = new Map<
      string,
      { user: User; commissions: Commission[]; totalAmount: number }
    >();

    for (const commission of commissions) {
      if (!commission.user?.walletAddress) {
        this.logger.warn(
          `Commission ${commission.id} has no wallet address, skipping`,
        );
        continue;
      }

      const walletAddress = commission.user.walletAddress.toLowerCase();
      const existing = grouped.get(walletAddress);

      if (existing) {
        existing.commissions.push(commission);
        existing.totalAmount += commission.amount;
      } else {
        grouped.set(walletAddress, {
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

    for (const [walletAddress, data] of grouped.entries()) {
      recipients.push({
        userId: data.user.id,
        walletAddress: walletAddress,
        amount: data.totalAmount.toString(),
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
      const specificCommissionIds = dto.recipients.flatMap(r => r.commissionIds || []);

      let commissions: Commission[];
      if (specificCommissionIds.length > 0) {
        commissions = await this.commissionRepository.find({
          where: {
            id: In(specificCommissionIds),
            status: CommissionStatus.PENDING,
          },
          relations: ['user'],
        });
      } else {
        const userIds = dto.recipients.map((r) => r.userId);
        commissions = await this.commissionRepository.find({
          where: {
            userId: In(userIds),
            status: CommissionStatus.PENDING,
          },
          relations: ['user'],
        });
      }

      if (commissions.length === 0) {
        throw new Error('No pending commissions found for the provided recipients');
      }

      // Prepare blockchain payout data
      const blockchainRecipients = dto.recipients.map((r) => ({
        address: r.walletAddress,
        amount: r.amount,
      }));

      // Generate batch ID if not provided
      const batchId =
        dto.batchId ||
        this.blockchainPayoutService.generateBatchId(
          blockchainRecipients.map((r) => r.address),
          blockchainRecipients.map((r) => r.amount),
        );

      // Execute blockchain payout
      this.logger.log(`Executing batch payout with batchId: ${batchId}`);
      const result = await this.blockchainPayoutService.batchPayout(
        blockchainRecipients,
        batchId,
      );

      // Update commissions in database (only those that were actually paid)
      const commissionMap = new Map<string, Commission[]>();
      for (const commission of commissions) {
        if (!commission.user?.walletAddress) continue;
        const walletAddress = commission.user.walletAddress.toLowerCase();
        if (!commissionMap.has(walletAddress)) {
          commissionMap.set(walletAddress, []);
        }
        commissionMap.get(walletAddress)!.push(commission);
      }

      // Update each commission
      for (const recipient of dto.recipients) {
        const walletAddress = recipient.walletAddress.toLowerCase();
        const userCommissions = commissionMap.get(walletAddress) || [];

        for (const commission of userCommissions) {
          commission.status = CommissionStatus.PAID;
          commission.payoutBatchId = batchId;
          commission.payoutTxHash = result.txHash;
          if (result.blockNumber !== undefined) {
            commission.payoutBlockNumber = result.blockNumber;
          }
          commission.payoutDate = new Date();

          await queryRunner.manager.save(Commission, commission);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Batch payout successful. BatchId: ${batchId}, TxHash: ${result.txHash}, Commissions: ${commissions.length}`,
      );

      // Log successful payout
      await this.auditLogService.create(
        {
          action: AuditLogAction.PAYOUT_EXECUTED,
          entityType: AuditLogEntityType.COMMISSION_PAYOUT,
          entityId: batchId,
          description: `Batch payout executed successfully. ${commissions.length} commissions paid`,
          metadata: {
            batchId,
            txHash: result.txHash,
            blockNumber: result.blockNumber,
            gasUsed: result.gasUsed?.toString(),
            commissionCount: commissions.length,
            recipientCount: dto.recipients.length,
            totalAmount: dto.recipients.reduce((sum, r) => sum + parseFloat(r.amount), 0),
          },
        },
        userId,
        username,
        ipAddress,
        userAgent,
      );

      return {
        batchId,
        txHash: result.txHash,
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
  ): Promise<{ batchId: string; txHash: string; success: boolean; count: number }> {
    if (commissionIds.length === 0) {
      throw new Error('No commission IDs provided');
    }

    const commissions = await this.commissionRepository.find({
      where: { id: In(commissionIds), status: CommissionStatus.PENDING },
      relations: ['user'],
    });

    if (commissions.length === 0) {
      throw new Error('No pending commissions found for the given IDs');
    }

    const validCommissions = commissions.filter((c) => c.user?.walletAddress);
    if (validCommissions.length === 0) {
      throw new Error('None of the selected commissions have a wallet address. Cannot payout.');
    }

    const { recipients } = await this.preparePayoutBatch(validCommissions);
    const result = await this.executeBatchPayout(
      { recipients },
      userId,
      username,
      ipAddress,
      userAgent,
    );
    return { ...result, count: validCommissions.length };
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

    // If orderId is provided, find the specific commission
    if (orderId) {
      const commission = await this.commissionRepository.findOne({
        where: {
          userId,
          orderId,
          status: CommissionStatus.PENDING,
        },
        relations: ['user'],
      });

      if (!commission) {
        throw new Error(`No pending commission found for orderId: ${orderId}`);
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
          amount: amount.toString(),
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
      const { recipients, commissionIds } = await this.preparePayoutBatch(
        pendingCommissions,
      );

      if (recipients.length === 0) {
        this.logger.warn('No valid recipients found');
        return { batchId: '', txHash: '', count: 0 };
      }

      // Execute payout
      const dto: BatchPayoutDto = {
        recipients,
      };

      const result = await this.executeBatchPayout(dto, 'system', 'system', undefined, undefined);

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
   * Check a single user's total PENDING commissions.
   * If they meet or exceed the minPayoutThreshold → pay ALL their pending commissions immediately.
   * Otherwise, leave them accumulating.
   */
  async checkAndPayoutUser(
    userId: string,
    minThreshold: number,
  ): Promise<void> {
    // Sum all PENDING commissions for this user
    const pendingCommissions = await this.commissionRepository.find({
      where: { userId, status: CommissionStatus.PENDING },
      relations: ['user'],
    });

    if (pendingCommissions.length === 0) return;

    const totalPending = pendingCommissions.reduce((sum, c) => sum + Number(c.amount), 0);

    this.logger.log(`[THRESHOLD PAYOUT] User ${userId}: totalPending=${totalPending}, threshold=${minThreshold}`);

    if (totalPending < minThreshold) {
      this.logger.debug(`[THRESHOLD PAYOUT] User ${userId} has not reached threshold (${totalPending} < ${minThreshold}). Commissions will accumulate.`);
      return;
    }

    // Threshold reached → pay all pending commissions
    const validCommissions = pendingCommissions.filter((c) => c.user?.walletAddress);
    if (validCommissions.length === 0) {
      this.logger.warn(`[THRESHOLD PAYOUT] User ${userId} has reached threshold but has no wallet address. Skipping payout.`);
      return;
    }

    this.logger.log(`[THRESHOLD PAYOUT] User ${userId} reached threshold. Paying ${validCommissions.length} commissions (total: ${totalPending})`);

    try {
      const { recipients } = await this.preparePayoutBatch(validCommissions);
      if (recipients.length === 0) return;

      await this.executeBatchPayout(
        { recipients },
        'system',
        'system',
        undefined,
        undefined,
      );
    } catch (error: any) {
      this.logger.error(`[THRESHOLD PAYOUT] Payout failed for user ${userId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Payout commissions for a specific order — now uses per-user threshold accumulation.
   * Instead of paying immediately, checks each recipient's total pending balance.
   * Pays only when they've accumulated >= minPayoutThreshold.
   */
  async payoutOrderCommissions(orderId: string): Promise<{ count: number } | null> {
    this.logger.log(`[PAYOUT] Checking threshold payout after order: ${orderId}`);

    // Get all PENDING commissions for this order to find affected users
    const orderCommissions = await this.commissionRepository.find({
      where: { orderId, status: CommissionStatus.PENDING },
    });

    if (orderCommissions.length === 0) {
      this.logger.warn(`[PAYOUT] No pending commissions for order ${orderId}`);
      return null;
    }

    // Get the configured minimum payout threshold
    const minThreshold = await this.adminService.getMinPayoutThreshold();
    this.logger.log(`[PAYOUT] Min payout threshold: $${minThreshold}`);

    // Collect unique user IDs that received commission from this order
    const affectedUserIds = [...new Set(orderCommissions.map((c) => c.userId))];
    this.logger.log(`[PAYOUT] ${affectedUserIds.length} users affected by order ${orderId}`);

    // For each user, check if they've accumulated enough to receive payout
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

    const contractBalance = await this.blockchainPayoutService.getContractBalance();

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
      contractAddress: (await this.blockchainPayoutService.getContractInfo()).contractAddress,
      tokenAddress: (await this.blockchainPayoutService.getContractInfo()).tokenAddress,
    };
  }

  /**
   * Withdraw funds from contract to specific wallet
   */
  async withdrawToWallet(
    recipientAddress: string,
    amount: string,
  ): Promise<{ txHash: string; blockNumber: number }> {
    return this.blockchainPayoutService.emergencyWithdraw(
      recipientAddress,
      amount,
    );
  }
}
