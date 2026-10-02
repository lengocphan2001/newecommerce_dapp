import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { SalaryService } from './salary.service';
import { RankSalaryService } from './rank-salary.service';
import { PaySalaryDto } from './dto/pay-salary.dto';
import { AddRankMemberDto, RankMemberDto } from './dto/rank-member.dto';

type AdminRequest = {
  user?: { username?: string; email?: string; sub?: string; id?: string };
};

/** Admin who paid (username, email or id, whichever the token carries). */
const paidByOf = (req: AdminRequest) =>
  String(
    req.user?.username ||
      req.user?.email ||
      req.user?.sub ||
      req.user?.id ||
      'unknown',
  );

@Controller('admin/salary')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSalaryController {
  constructor(
    private readonly salaryService: SalaryService,
    private readonly rankSalaryService: RankSalaryService,
  ) {}

  /**
   * Users whose reward sales (weak branch sales) for the month reach a salary
   * tier, with their computed salary and whether it has been paid.
   */
  @Get('eligible')
  getEligible(@Query('month') month: string) {
    return this.salaryService.getEligibleUsers(month);
  }

  /** Pay the computed salary to the listed users, or to all unpaid ones. */
  @Post('pay')
  pay(@Body() dto: PaySalaryDto, @Request() req: AdminRequest) {
    return this.salaryService.paySalaries(dto, paidByOf(req));
  }

  /**
   * C1 / C2 agents with their rank salary for the month: equal shares of the
   * C1 pool (4% of C1 + C2 reward sales) and the C2 pool (2% of C2 reward sales).
   */
  @Get('rank/eligible')
  getRankEligible(@Query('month') month: string) {
    return this.rankSalaryService.getEligibleUsers(month);
  }

  /** Pay the rank salary to the listed C1 / C2 agents, or to all unpaid ones. */
  @Post('rank/pay')
  payRank(@Body() dto: PaySalaryDto, @Request() req: AdminRequest) {
    return this.rankSalaryService.paySalaries(dto, paidByOf(req));
  }

  /** Add a user who is not C1 / C2 in the month to its rank salary list. */
  @Post('rank/members')
  addRankMember(@Body() dto: AddRankMemberDto, @Request() req: AdminRequest) {
    return this.rankSalaryService.addMember(dto, paidByOf(req));
  }

  /** Remove a user from the month's rank salary list. */
  @Post('rank/members/remove')
  removeRankMember(@Body() dto: RankMemberDto, @Request() req: AdminRequest) {
    return this.rankSalaryService.removeMember(dto, paidByOf(req));
  }

  /** Put a removed agent back on the month's rank salary list. */
  @Post('rank/members/restore')
  restoreRankMember(@Body() dto: RankMemberDto, @Request() req: AdminRequest) {
    return this.rankSalaryService.restoreMember(dto, paidByOf(req));
  }

  @Get('payments')
  getPayments(
    @Query()
    query: {
      month?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    return this.salaryService.getPayments(query);
  }
}
