import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitKycDto {
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsString()
  @IsOptional()
  frontImage?: string;

  @IsString()
  @IsOptional()
  backImage?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  bankAccountHolder?: string;

  @IsString()
  @IsOptional()
  bankBranch?: string;
}

