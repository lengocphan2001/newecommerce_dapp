import { IsArray, IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ApproveCommissionDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  commissionIds: string[]; // Array of commission IDs to approve
}

export class ApproveSingleCommissionDto {
  @IsString()
  @IsNotEmpty()
  commissionId: string;
  
  @IsOptional()
  @IsString()
  notes?: string; // Optional notes for approval
}
