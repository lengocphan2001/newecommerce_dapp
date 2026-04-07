import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Token is required' })
  @MaxLength(256)
  token: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(12, { message: 'New password must be at least 12 characters' })
  @MaxLength(128)
  newPassword: string;
}
