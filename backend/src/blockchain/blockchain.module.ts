import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Web3Service } from './web3.service';
import { CommissionPayoutService } from './commission-payout.service';

@Module({
  imports: [ConfigModule],
  providers: [Web3Service, CommissionPayoutService],
  exports: [Web3Service, CommissionPayoutService],
})
export class BlockchainModule {}
