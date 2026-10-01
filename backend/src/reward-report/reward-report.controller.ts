import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { RewardReportService } from './reward-report.service';
import {
  RewardEntriesQueryDto,
  RewardReportQueryDto,
  RewardTimeseriesQueryDto,
  RewardTopUsersQueryDto,
} from './dto/reward-report-query.dto';

/**
 * Admin accounts only (super admin, or a user flagged admin), the same rule
 * as the admin panel's AdminOnlyRoute; staff with a role cannot read it.
 */
@Injectable()
export class AdminAccountGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (user?.isSuperAdmin === true || (user?.type === 'user' && user?.isAdmin)) {
      return true;
    }
    throw new ForbiddenException('Admin access required');
  }
}

@Controller('admin/reward-report')
@UseGuards(JwtAuthGuard, AdminAccountGuard)
export class RewardReportController {
  constructor(private readonly rewardReportService: RewardReportService) {}

  /** Totals per source and sub type, with the split by wallet and status. */
  @Get('summary')
  getSummary(@Query() query: RewardReportQueryDto) {
    return this.rewardReportService.getSummary(query);
  }

  /** Amount per day or month, per source. */
  @Get('timeseries')
  getTimeseries(@Query() query: RewardTimeseriesQueryDto) {
    return this.rewardReportService.getTimeseries(query);
  }

  /** Every reward row, newest first, paginated. */
  @Get('entries')
  getEntries(@Query() query: RewardEntriesQueryDto) {
    return this.rewardReportService.getEntries(query);
  }

  /** Users rewarded the most, with their amount per source. */
  @Get('top-users')
  getTopUsers(@Query() query: RewardTopUsersQueryDto) {
    return this.rewardReportService.getTopUsers(query);
  }
}
