import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { REWARD_SOURCES, REWARD_STATUSES } from '../reward-report.types';

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `?a=x,y`, `?a=x&a=y` and `?a=x` all become `['x', 'y']` / `['x']`. */
const toList = ({ value }: { value: unknown }) =>
  (Array.isArray(value) ? value : String(value ?? '').split(','))
    .map((v) => String(v).trim())
    .filter(Boolean);

/** Filters shared by every reward report endpoint. */
export class RewardReportQueryDto {
  /** First day, YYYY-MM-DD. Salaries are taken by sales month, from this month. */
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from: string;

  /** Last day (inclusive), YYYY-MM-DD. Salaries up to this month. */
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to: string;

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(REWARD_SOURCES, { each: true })
  sources?: string[];

  /** Commission type, heap pool, matrix tree, agent pool code, salary tier or rank. */
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  subTypes?: string[];

  @IsOptional()
  @Transform(toList)
  @IsArray()
  @IsIn(REWARD_STATUSES, { each: true })
  statuses?: string[];

  @IsOptional()
  @Matches(UUID, { message: 'userId must be a UUID' })
  userId?: string;

  /** Matches username, full name, email or phone of the receiving user. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class RewardTimeseriesQueryDto extends RewardReportQueryDto {
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: 'day' | 'month';
}

export class RewardEntriesQueryDto extends RewardReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** Up to 5000 so the admin can export a whole range in a few requests. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

export class RewardTopUsersQueryDto extends RewardReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
