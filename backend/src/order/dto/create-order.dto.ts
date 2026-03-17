import { IsArray, IsNotEmpty, ValidateNested, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  properties?: { [key: string]: string };
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsNotEmpty()
  items: OrderItemDto[];

  @IsString()
  @IsOptional()
  transactionHash?: string;

  @IsString()
  @IsOptional()
  shippingAddress?: string;

  /** Phone number for shipping (e.g. from selected address). Used in Google Sheet. */
  @IsString()
  @IsOptional()
  shippingPhone?: string;

  /** Recipient name for shipping (e.g. from selected address). Used in Google Sheet. */
  @IsString()
  @IsOptional()
  shippingName?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string; // 'wallet' | 'banking' | 'deposit_wallet'
}

