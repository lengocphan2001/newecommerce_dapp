import {
  IsNumber,
  IsNotEmpty,
  Min,
  IsString,
  IsOptional,
} from 'class-validator';

export class CreateDepositRequestDto {
  /** Số tiền đã chuyển (VND). Bắt buộc nếu method là BANKING. */
  @IsNumber()
  @IsOptional()
  @Min(1000, { message: 'Số tiền VND tối thiểu 1.000' })
  amountVnd?: number;

  @IsString()
  @IsOptional()
  method?: 'BANKING' | 'USDT';

  @IsNumber()
  @IsOptional()
  @Min(0.000001, { message: 'Số lượng USDT tối thiểu là 0.000001' })
  requestedUsdt?: number;

  @IsString()
  @IsOptional()
  txHash?: string;

  /** URL ảnh chứng từ chuyển khoản (sau khi upload) */
  @IsString()
  @IsOptional()
  proofImageUrl?: string;

  /** Ghi chú: mã giao dịch, ngân hàng, nội dung chuyển... */
  @IsString()
  @IsOptional()
  transferNote?: string;
}
