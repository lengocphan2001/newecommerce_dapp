import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletDepositRequest } from './entities/wallet-deposit-request.entity';
import { User } from '../user/entities/user.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletDepositRequest, User, BankingConfig]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}

