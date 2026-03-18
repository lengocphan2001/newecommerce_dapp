import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UsernameRegisterDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9]+$/, {
    message:
      'Username can only contain letters and numbers (no spaces or special characters)',
  })
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  referralUser?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  @IsIn(['left', 'right'])
  leg?: 'left' | 'right';
}
