import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  IsArray,
  ArrayUnique,
  Matches,
  IsUUID,
  Max,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  nameEn?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  descriptionEn?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingFee?: number;

  @Matches(/^https?:\/\/.+/, {
    message: 'thumbnailUrl must be a valid URL (http:// or https://)',
  })
  @IsOptional()
  thumbnailUrl?: string;

  @IsArray()
  @ArrayUnique()
  @Matches(/^https?:\/\/.+/, {
    each: true,
    message: 'each value in detailImageUrls must be a valid URL (http:// or https://)',
  })
  @IsOptional()
  detailImageUrls?: string[];

  @IsArray()
  @IsOptional()
  countries?: ('VIETNAM' | 'USA')[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsOptional()
  properties?: { name: string; values: string[] }[];

  @IsArray()
  @IsOptional()
  combos?: { quantity: number; price: number; label?: string }[];

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  brandEn?: string;

  @IsString()
  @IsOptional()
  origin?: string;

  @IsString()
  @IsOptional()
  originEn?: string;

  @IsString()
  @IsOptional()
  clothingType?: string;

  @IsString()
  @IsOptional()
  clothingTypeEn?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  fakeSold?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  featuredOnHome?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  salePercentage?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  useProductCommission?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentTV?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentCTV?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentNPP?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentGroupTV?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentGroupCTV?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentGroupNPP?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentManagementTV?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentManagementCTV?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercentManagementNPP?: number;
}

