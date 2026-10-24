import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Add a user, found by username, email or ID, to the month's C1 / C2 list. */
export class AddRankMemberDto {
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  queryStr: string;

  @IsIn(['C1', 'C2'])
  rank: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Remove a user from the month's C1 / C2 list, or restore a removed one. */
export class RankMemberDto {
  @Matches(MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
