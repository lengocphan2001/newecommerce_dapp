import { IsArray, IsNotEmpty, IsString, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class PayoutRecipientDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  amount: string; // Amount in token units (as string to preserve precision)

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  commissionIds?: string[]; // Optional: specifically which commissions to pay
}

export class BatchPayoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PayoutRecipientDto)
  recipients: PayoutRecipientDto[];

  @IsString()
  @IsNotEmpty()
  batchId?: string; // Optional, will be generated if not provided
}

export class BatchPayoutResponseDto {
  batchId: string;
  txHash: string;
  recipients: string[];
  amounts: string[];
  gasUsed?: string;
  blockNumber?: number;
  timestamp: Date;
}
