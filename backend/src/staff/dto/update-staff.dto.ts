import { IsEmail, IsString, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';

export class UpdateStaffDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsArray()
  @IsOptional()
  roleIds?: string[];

  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  @IsOptional()
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @IsBoolean()
  @IsOptional()
  isSuperAdmin?: boolean;
}
