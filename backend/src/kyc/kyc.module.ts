import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { Kyc } from './entities/kyc.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Kyc])],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule { }

