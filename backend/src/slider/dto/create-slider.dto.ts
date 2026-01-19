import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Matches,
  Min,
} from 'class-validator';

export class CreateSliderDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^https?:\/\/.+/, {
    message: 'imageUrl must be a valid URL (http:// or https://)',
  })
  imageUrl: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, {
    message: 'linkUrl must be a valid URL (http:// or https://)',
  })
  linkUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
