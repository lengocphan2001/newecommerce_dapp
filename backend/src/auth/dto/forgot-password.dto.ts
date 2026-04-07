import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Identifier is required' })
  @MaxLength(120)
  identifier: string;
}
