import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmPaymentDto {
    @IsString()
    @IsNotEmpty()
    transactionHash: string;
}
