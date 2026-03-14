import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateFakeCommissionDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fakeReceivedCommission: number;
}
