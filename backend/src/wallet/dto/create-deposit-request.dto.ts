import { IsNumber, IsNotEmpty, Min, IsString, IsOptional } from 'class-validator';

export class CreateDepositRequestDto {
  /** Số tiền đã chuyển (VND). Admin sẽ dùng tỉ giá Banking Settings để quy đổi USDT khi duyệt. */
  @IsNumber()
  @IsNotEmpty()
  @Min(1000, { message: 'Số tiền VND tối thiểu 1.000' })
  amountVnd: number;

  /** URL ảnh chứng từ chuyển khoản (sau khi upload) */
  @IsString()
  @IsOptional()
  proofImageUrl?: string;

  /** Ghi chú: mã giao dịch, ngân hàng, nội dung chuyển... */
  @IsString()
  @IsOptional()
  transferNote?: string;
}
