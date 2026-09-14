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
import { PaySalaryDto } from './dto/pay-salary.dto';

@Controller('admin/salary')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  /** Agents (C1 and above) of a closed month, with the salary already paid. */
  @Get('eligible')
  getEligible(@Query('month') month: string) {
    return this.salaryService.getEligibleUsers(month);
  }

  /** Credit salaries to one or more agents' withdraw wallets. */
  @Post('pay')
  pay(
    @Body() dto: PaySalaryDto,
    @Request()
    req: {
      user?: { username?: string; email?: string; sub?: string; id?: string };
    },
  ) {
    const paidBy =
      req.user?.username ||
      req.user?.email ||
      req.user?.sub ||
      req.user?.id ||
      'unknown';
    return this.salaryService.paySalaries(dto, String(paidBy));
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
