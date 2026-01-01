import { IsString, IsNotEmpty } from 'class-validator';

export class CheckReferralDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}

