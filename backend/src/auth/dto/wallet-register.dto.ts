import { IsEmail, IsNotEmpty, IsString, IsOptional, IsPhoneNumber, IsIn } from 'class-validator';
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
