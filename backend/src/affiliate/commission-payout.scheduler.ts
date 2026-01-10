import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CommissionPayoutService } from './commission-payout.service';
import { ConfigService } from '@nestjs/config';

/**
 * Scheduler for automatic commission payouts
 */
@Injectable()
export class CommissionPayoutScheduler {
  private readonly logger = new Logger(CommissionPayoutScheduler.name);
  private isRunning = false;

  constructor(
    private readonly commissionPayoutService: CommissionPayoutService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * DISABLED: Auto payout every hour
   * Commission payout now happens immediately when admin approves an order
   * This scheduler is kept for potential future use but is currently disabled
   */
  // @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyPayout() {
    // DISABLED: Payout now happens immediately when order is approved
    this.logger.debug('Scheduled auto payout is disabled. Payout happens immediately on order approval.');
    return;
    
    // Legacy code below (disabled)
    /*
    if (this.isRunning) {
      this.logger.warn('Previous payout job still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting scheduled auto payout...');

    try {
      const batchSize = parseInt(
        this.configService.get<string>('AUTO_PAYOUT_BATCH_SIZE') || '50',
        10,
      );
      const minAmount = this.configService.get<string>('AUTO_PAYOUT_MIN_AMOUNT')
        ? parseFloat(this.configService.get<string>('AUTO_PAYOUT_MIN_AMOUNT')!)
        : undefined;

      const result = await this.commissionPayoutService.autoPayout(
        batchSize,
        minAmount,
      );

      if (result.count > 0) {
        this.logger.log(
          `Auto payout completed. BatchId: ${result.batchId}, TxHash: ${result.txHash}, Count: ${result.count}`,
        );
      } else {
        this.logger.log('No commissions to payout');
      }
    } catch (error: any) {
      this.logger.error('Auto payout failed', error);
    } finally {
      this.isRunning = false;
    }
    */
  }

}
