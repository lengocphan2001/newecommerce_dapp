import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { WalletWithdrawMethod } from '../entities/wallet-withdraw-request.entity';

export class CreateWithdrawRequestDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsEnum(WalletWithdrawMethod)
  method: WalletWithdrawMethod;

  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
