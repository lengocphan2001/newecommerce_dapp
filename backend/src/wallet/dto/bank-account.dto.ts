import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bankName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bankCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  qrImageUrl: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  bankName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bankCode?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  qrImageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
