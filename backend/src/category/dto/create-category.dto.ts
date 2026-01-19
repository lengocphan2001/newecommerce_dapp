import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Matches(/^https?:\/\/.+/, {
    message: 'imageUrl must be a valid URL (http:// or https://)',
  })
  @IsOptional()
  imageUrl?: string;
}
