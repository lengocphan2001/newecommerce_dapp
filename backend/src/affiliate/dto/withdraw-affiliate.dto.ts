import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class WithdrawAffiliateDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;
}

