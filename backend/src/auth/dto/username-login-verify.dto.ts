import {
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  Length,
} from 'class-validator';

export class UsernameLoginVerifyDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Code must be 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}
