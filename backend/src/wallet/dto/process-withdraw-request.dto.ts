import { IsIn, IsOptional, IsString } from 'class-validator';

export class ProcessWithdrawRequestDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  adminNote?: string;
}
