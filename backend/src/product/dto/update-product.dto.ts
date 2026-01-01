import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ArrayUnique,
  Matches,
} from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  price?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stock?: number;

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
}

