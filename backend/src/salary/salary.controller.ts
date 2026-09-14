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

  /**
   * Users whose reward sales (weak branch sales) for the month are in the
   * tier [minSales, maxSales), with the salary already paid for that month.
   */
  @Get('eligible')
  getEligible(
    @Query('month') month: string,
    @Query('minSales') minSales?: string,
    @Query('maxSales') maxSales?: string,
  ) {
    return this.salaryService.getEligibleUsers(month, minSales, maxSales);
  }

  /** Pay salaries to one or more users of the same tier. */
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
