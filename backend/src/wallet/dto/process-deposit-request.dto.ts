import { IsString, IsOptional, IsIn } from 'class-validator';

export class ProcessDepositRequestDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  adminNote?: string;
}
