import { IsString, IsOptional } from 'class-validator';

export class RegisterAffiliateDto {
  @IsString()
  @IsOptional()
  referralCode?: string;
}

