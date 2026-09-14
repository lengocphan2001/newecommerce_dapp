import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SalaryPaymentItemDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.00000001, { message: 'amount must be greater than 0' })
  amount: number;
}

export class PaySalaryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' })
  month: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => SalaryPaymentItemDto)
  items: SalaryPaymentItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
