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
  @Min(30, { message: 'Số tiền rút tối thiểu là 30 USDT' })
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
