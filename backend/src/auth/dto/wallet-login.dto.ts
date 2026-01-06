import { IsString, IsNotEmpty } from 'class-validator';

export class WalletLoginDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}
