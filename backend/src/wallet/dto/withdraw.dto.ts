import { IsNumber, IsNotEmpty, Min, IsString } from 'class-validator';

export class WithdrawDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}

