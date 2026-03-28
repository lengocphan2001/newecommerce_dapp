import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsIn,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  walletAddress?: string;

  @IsString()
  @IsOptional()
  chainId?: string;

  @IsString()
  @IsOptional()
  referralUser?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v != null)
  @IsUUID('4')
  referralUserId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v != null)
  @IsUUID('4')
  parentId?: string | null;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v != null)
  @IsIn(['left', 'right'])
  position?: 'left' | 'right' | null;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  packageType?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsOptional()
  isActive?: boolean;
}

