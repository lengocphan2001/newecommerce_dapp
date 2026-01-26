import {
  IsString,
  IsOptional,
  Matches,
  IsUUID,
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

  @IsOptional()
  @IsUUID(undefined, { message: 'parentId must be a valid UUID when provided' })
  parentId?: string | null;
}
