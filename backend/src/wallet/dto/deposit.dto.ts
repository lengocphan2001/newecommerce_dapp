import { IsNumber, IsNotEmpty, Min, IsString } from 'class-validator';

export class DepositDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;
}

