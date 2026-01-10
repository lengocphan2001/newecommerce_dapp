import { IsEnum, IsNumber, IsOptional, IsNotEmpty, Min, Max } from 'class-validator';
import { PackageType } from '../entities/commission-config.entity';

export class UpdateCommissionConfigDto {
  @IsEnum(PackageType)
  @IsOptional()
  packageType?: PackageType;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  directRate?: number; // 0-1 (0% to 100%)

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  groupRate?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  managementRateF1?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  managementRateF2?: number | null;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  managementRateF3?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  packageValue?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reconsumptionThreshold?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reconsumptionRequired?: number;
}

export class CreateCommissionConfigDto {
  @IsEnum(PackageType)
  @IsNotEmpty()
  packageType: PackageType;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  directRate?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  groupRate?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  managementRateF1?: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  managementRateF2?: number | null;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  managementRateF3?: number | null;

  @IsNumber()
  @Min(0)
  @IsOptional()
  packageValue?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reconsumptionThreshold?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reconsumptionRequired?: number;
}
