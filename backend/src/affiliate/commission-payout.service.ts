import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Commission, CommissionStatus, CommissionType } from './entities/commission.entity';
import { User } from '../user/entities/user.entity';
import { CommissionPayoutService as BlockchainPayoutService } from '../blockchain/commission-payout.service';
import { BatchPayoutDto, PayoutRecipientDto } from './dto/batch-payout.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditLogAction, AuditLogEntityType } from '../audit-log/entities/audit-log.entity';
import { AdminService } from '../admin/admin.service';

/** Payout fee: 10% is withheld; user receives 90% of accumulated commission */
const PAYOUT_FEE_PERCENT = 10;

/**
 * Returns the amount to actually send to the user after deducting the payout fee (90% of gross).
 * Used so we don't pay 100% of commission — 10% is kept as fee.
 */
function getPayoutAmountAfterFee(grossAmount: number): string {
  const netAmount = grossAmount * (1 - PAYOUT_FEE_PERCENT / 100);
  return Number(netAmount.toFixed(18)).toFixed(18);
}

/**
 * Commission được trả ngay (không cần đạt ngưỡng): Direct từ package HOẶC Product direct (type=PRODUCT, notes bắt đầu "Product direct").
 */
function isPayImmediately(commission: Commission): boolean {
  if (commission.type === CommissionType.DIRECT) return true;
  if (commission.type === CommissionType.PRODUCT && commission.notes?.startsWith('Product direct')) return true;
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
      const grossAmount = Number(data.totalAmount).toFixed(18);
      this.logger.debug(
        `Payout ${walletAddress}: gross=${data.totalAmount} (fee ${PAYOUT_FEE_PERCENT}% applied at execute)`,
      );
      recipients.push({
        userId: data.user.id,
        walletAddress: walletAddress,
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

      // Always apply 10% payout fee before sending to blockchain (single place: so admin UI, auto-payout, and order-approval all send 90% to chain)
      const blockchainRecipients = dto.recipients.map((r) => {
        const gross = parseFloat(r.amount);
        const netAmount = getPayoutAmountAfterFee(isNaN(gross) ? 0 : gross);
        this.logger.debug(
          `Payout fee: ${r.walletAddress} gross=${gross} -> net=${netAmount} (${PAYOUT_FEE_PERCENT}% withheld)`,
        );
        return {
          address: r.walletAddress,
          amount: netAmount,
        };
      });

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
        throw new Error(`No pending commission found for ${isMilestone ? 'milestoneRef' : 'orderId'}: ${orderId}`);
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
    this.logger.warn(
      `[AUTO PAYOUT DISABLED] Requested auto payout (batchSize=${batchSize}, minAmount=${minAmount ?? 'none'})`,
    );
    return { batchId: '', txHash: '', count: 0 };
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
    const nonDirectPending = pendingCommissions.filter((c) => !isPayImmediately(c));

    // 1) Pay all direct (package DIRECT + product direct) immediately (no threshold)
    if (directPending.length > 0) {
      const valid = directPending.filter((c) => c.user?.walletAddress);
      if (valid.length > 0) {
        const totalDirect = valid.reduce((sum, c) => sum + Number(c.amount), 0);
        this.logger.log(`[THRESHOLD PAYOUT] User ${userId}: paying ${valid.length} direct commissions (total: ${totalDirect}) immediately`);
        try {
          const { recipients } = await this.preparePayoutBatch(valid);
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
          this.logger.error(`[THRESHOLD PAYOUT] Direct payout failed for user ${userId}: ${error.message}`, error.stack);
        }
      }
    }

    // 2) Non-direct (group, product, management): pay only when total >= threshold
    if (nonDirectPending.length === 0) return;

    const totalNonDirect = nonDirectPending.reduce((sum, c) => sum + Number(c.amount), 0);
    this.logger.log(`[THRESHOLD PAYOUT] User ${userId}: non-direct pending=${totalNonDirect}, threshold=${minThreshold}`);

    if (totalNonDirect < minThreshold) {
      this.logger.debug(`[THRESHOLD PAYOUT] User ${userId} has not reached threshold. Group/other will accumulate.`);
      return;
    }

    const validNonDirect = nonDirectPending.filter((c) => c.user?.walletAddress);
    if (validNonDirect.length === 0) {
      this.logger.warn(`[THRESHOLD PAYOUT] User ${userId} has no wallet. Skipping group payout.`);
      return;
    }

    this.logger.log(`[THRESHOLD PAYOUT] User ${userId} reached threshold. Paying ${validNonDirect.length} non-direct commissions (total: ${totalNonDirect})`);
    try {
      const { recipients } = await this.preparePayoutBatch(validNonDirect);
      if (recipients.length === 0) return;
      await this.executeBatchPayout(
        { recipients },
        'system',
        'system',
        undefined,
        undefined,
      );
    } catch (error: any) {
      this.logger.error(`[THRESHOLD PAYOUT] Group payout failed for user ${userId}: ${error.message}`, error.stack);
    }
  }

  /**
   * Payout commissions for a specific order.
   * - DIRECT commission: paid immediately (no threshold).
   * - GROUP (and other types): accumulated; pay only when user's total pending >= minPayoutThreshold.
   */
  async payoutOrderCommissions(orderId: string): Promise<{ count: number } | null> {
    this.logger.warn(
      `[AUTO PAYOUT DISABLED] Ignored payoutOrderCommissions for order ${orderId}. Commissions stay PENDING for admin manual approval.`,
    );
    return { count: 0 };
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
