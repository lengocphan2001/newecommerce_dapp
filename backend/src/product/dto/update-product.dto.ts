import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ArrayUnique,
  Matches,
  IsUUID,
  Max,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

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
  @IsOptional()
  @Min(0)
  price?: number;

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
    message:
      'each value in detailImageUrls must be a valid URL (http:// or https://)',
  })
  @IsOptional()
  detailImageUrls?: string[];

  @IsArray()
  @IsOptional()
  countries?: ('VIETNAM' | 'USA')[];

  @IsArray()
  @IsOptional()
  productTypes?: string[];

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
  indirectCommissionRateF2?: number;

  // Xác định sản phẩm có phải là sản phẩm triển vọng để áp dụng cơ chế đồng chia đa bể và hàng đợi FIFO hay không
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isPromisingProduct?: boolean;


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

  @IsNumber()
  @IsOptional()
  @Min(0)
  groupCommissionMinSales?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  managementRateF1?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  managementRateF2?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  managementRateF3?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  managementMinSales?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reconsumptionThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reconsumptionRequired?: number;

  @IsOptional()
  @IsObject()
  commissionConfigByPackage?: Record<
    string,
    {
      directCommissionRate?: number;
      groupCommissionRate?: number;
      groupCommissionMinSales?: number;
      managementRateF1?: number;
      managementRateF2?: number | null;
      managementRateF3?: number | null;
      managementMinSales?: number;
      reconsumptionThreshold?: number;
      reconsumptionRequired?: number;
    }
  >;
}
