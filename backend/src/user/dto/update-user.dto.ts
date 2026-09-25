import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsUUID,
  IsIn,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const emptyToNull = ({ value }: { value: unknown }) =>
  value === '' ? null : value;

const emptyToUndef = ({ value }: { value: unknown }) =>
  value === '' || value === undefined || value === null ? undefined : value;

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
  taxId?: string;

  @IsString()
  @IsOptional()
  chainId?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  referralUser?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID('4')
  referralUserId?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @Transform(({ value }) => (value === '' ? null : value))
  @IsOptional()
  @IsIn(['left', 'right'])
  position?: 'left' | 'right' | null;

  @IsString()
  @IsOptional()
  packageType?: string;

  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED'])
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isAdmin?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  emailVerified?: boolean;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  /** Legacy: map to status when status not sent */
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalPurchaseAmount?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalCommissionReceived?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  fakeReceivedCommission?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  totalReconsumptionAmount?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  leftBranchTotal?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  rightBranchTotal?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  walletBalance?: number;

  /** Balance del monedero en PV. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  pvWalletBalance?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  withdrawWalletBalance?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  reconsumptionWalletBalance?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  customMaxCommission?: number | null;

  @IsString()
  @IsOptional()
  manualRank?: string;
}
