import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class CreateWalletSwapDto {
  /** Amount in USDT to move from the reward wallet to the consumption wallet. */
  @IsNumber()
  @IsNotEmpty()
  @Min(0.000001, { message: 'Số tiền chuyển phải lớn hơn 0' })
  amount: number;
}
