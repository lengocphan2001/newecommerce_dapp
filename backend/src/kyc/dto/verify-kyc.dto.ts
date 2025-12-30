import { IsBoolean, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class VerifyKycDto {
  @IsBoolean()
  @IsNotEmpty()
  approved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

