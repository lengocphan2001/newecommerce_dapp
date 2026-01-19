import {
  IsString,
  IsOptional,
  Matches,
} from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Matches(/^https?:\/\/.+/, {
    message: 'imageUrl must be a valid URL (http:// or https://)',
  })
  @IsOptional()
  imageUrl?: string;
}
