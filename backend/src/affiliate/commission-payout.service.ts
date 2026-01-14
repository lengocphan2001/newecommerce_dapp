import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Commission, CommissionStatus } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';
import { CommissionPayoutService as BlockchainPayoutService } from '../blockchain/commission-payout.service';
import { BatchPayoutDto, PayoutRecipientDto } from './dto/batch-payout.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditLogAction, AuditLogEntityType } from '../audit-log/entities/audit-log.entity';

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
      this.logger.error('Batch payout failed', error);

      // Log failed payout
      const batchId = dto.batchId || 'unknown';
      await this.auditLogService.create(
        {
          action: AuditLogAction.PAYOUT_FAILED,
          entityType: AuditLogEntityType.COMMISSION_PAYOUT,
          entityId: batchId,
          description: `Batch payout failed: ${error.message}`,
          metadata: {
            batchId,
            error: error.message,
            stack: error.stack,
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
   * Payout commissions for a specific order immediately
   * Called when admin approves an order
   */
  async payoutOrderCommissions(orderId: string): Promise<{ batchId: string; txHash: string; count: number } | null> {
    this.logger.log(`[PAYOUT] Starting payout for order: ${orderId}`);

    // Get pending commissions for this order (chỉ payout PENDING, không payout BLOCKED)
    const orderCommissions = await this.commissionRepository.find({
      where: {
        orderId,
        status: CommissionStatus.PENDING,
      },
      relations: ['user'],
    });

    this.logger.log(`[PAYOUT] Found ${orderCommissions.length} PENDING commissions for order ${orderId}`);

    if (orderCommissions.length === 0) {
      this.logger.warn(`[PAYOUT] No pending commissions found for order ${orderId}. Checking all commissions...`);
      // Debug: Check all commissions for this order
      const allCommissions = await this.commissionRepository.find({
        where: { orderId },
        relations: ['user'],
      });
      this.logger.warn(`[PAYOUT] Total commissions for order ${orderId}: ${allCommissions.length}`);
      allCommissions.forEach((c) => {
        this.logger.warn(`[PAYOUT] Commission ${c.id}: type=${c.type}, status=${c.status}, amount=${c.amount}, userId=${c.userId}, walletAddress=${c.user?.walletAddress || 'N/A'}`);
      });
      return null;
    }

    // Filter commissions with valid wallet addresses
    const validCommissions = orderCommissions.filter(
      (c) => c.user?.walletAddress,
    );

    this.logger.log(`[PAYOUT] Found ${validCommissions.length} commissions with wallet addresses out of ${orderCommissions.length} total`);

    if (validCommissions.length === 0) {
      this.logger.warn(`[PAYOUT] No commissions with wallet addresses for order ${orderId}. Commissions without wallet:`);
      orderCommissions.forEach((c) => {
        if (!c.user?.walletAddress) {
          this.logger.warn(`[PAYOUT] Commission ${c.id}: userId=${c.userId}, user=${c.user?.email || 'N/A'}, wallet=${c.user?.walletAddress || 'NONE'}`);
        }
      });
      return null;
    }

    // Log immediate payout start
    await this.auditLogService.create(
      {
        action: AuditLogAction.PAYOUT_CREATED,
        entityType: AuditLogEntityType.COMMISSION_PAYOUT,
        description: `Immediate payout for order ${orderId}. Count: ${validCommissions.length}`,
        metadata: {
          orderId,
          commissionCount: validCommissions.length,
          trigger: 'order_approved',
        },
      },
      'system',
      'system',
      undefined,
      undefined,
    );

    try {
      // Prepare batch
      const { recipients, commissionIds } = await this.preparePayoutBatch(
        validCommissions,
      );

      if (recipients.length === 0) {
        this.logger.warn(`No valid recipients found for order ${orderId}`);
        return null;
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

      this.logger.log(
        `Immediate payout completed for order ${orderId}. BatchId: ${result.batchId}, TxHash: ${result.txHash}, Count: ${commissionIds.length}`,
      );

      return {
        batchId: result.batchId,
        txHash: result.txHash,
        count: commissionIds.length,
      };
    } catch (error: any) {
      // Log immediate payout failure
      await this.auditLogService.create(
        {
          action: AuditLogAction.PAYOUT_FAILED,
          entityType: AuditLogEntityType.COMMISSION_PAYOUT,
          description: `Immediate payout failed for order ${orderId}: ${error.message}`,
          metadata: {
            orderId,
            error: error.message,
            trigger: 'order_approved',
          },
        },
        'system',
        'system',
        undefined,
        undefined,
      );
      this.logger.error(`Immediate payout failed for order ${orderId}`, error);
      // Don't throw - let order approval succeed even if payout fails
      return null;
    }
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
    };
  }
}
