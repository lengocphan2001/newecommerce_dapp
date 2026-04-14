import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class DeductWithdrawWalletDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.00000001, { message: 'amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
