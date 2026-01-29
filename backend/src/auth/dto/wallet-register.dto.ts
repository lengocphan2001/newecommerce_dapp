import { IsEmail, IsNotEmpty, IsString, IsOptional, IsPhoneNumber, IsIn, Matches, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class WalletRegisterDto {
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  chainId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'Username can only contain letters and numbers (no spaces or special characters)'
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  referralUser?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  @IsIn(['left', 'right'])
  leg?: 'left' | 'right';
}
