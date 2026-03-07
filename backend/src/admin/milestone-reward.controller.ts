import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MilestoneRewardService } from './milestone-reward.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/milestone-reward')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MilestoneRewardController {
  constructor(
    private readonly milestoneRewardService: MilestoneRewardService,
  ) {}

  @Get('config')
  async getConfig() {
    return this.milestoneRewardService.getConfig();
  }

  @Put('config')
  async updateConfig(
    @Body() body: { percentX: number; percentY: number; percentZ: number },
  ) {
    return this.milestoneRewardService.setConfig(
      body.percentX,
      body.percentY,
      body.percentZ,
    );
  }

  @Get('milestones')
  async getAllMilestones() {
    try {
      return await this.milestoneRewardService.getAllMilestones();
    } catch (error) {
      throw new HttpException(
        `Failed to fetch milestones: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Recheck and process milestone rewards for a user (referrer). Use when config was missing or referrer just became eligible. */
  @Post('recheck/:userId')
  async recheckMilestones(@Param('userId') userId: string) {
    try {
      await this.milestoneRewardService.checkAndProcessMilestones(userId);
      return { success: true, message: 'Milestone check completed for user ' + userId };
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Failed to recheck milestones',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
