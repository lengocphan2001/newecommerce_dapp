import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletDepositRequest } from './entities/wallet-deposit-request.entity';
import { WalletWithdrawRequest } from './entities/wallet-withdraw-request.entity';
import { UserBankAccount } from './entities/user-bank-account.entity';
import { User } from '../user/entities/user.entity';
import { BankingConfig } from '../admin/entities/banking-config.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    NotificationsModule,
    ConfigModule,
    BlockchainModule,
    TypeOrmModule.forFeature([
      WalletDepositRequest,
      WalletWithdrawRequest,
      UserBankAccount,
      User,
      BankingConfig,
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
