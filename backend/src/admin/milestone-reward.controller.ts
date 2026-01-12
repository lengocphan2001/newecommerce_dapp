import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
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
    @Body() body: { rewardX: number; rewardY: number; rewardZ: number },
  ) {
    return this.milestoneRewardService.setConfig(
      body.rewardX,
      body.rewardY,
      body.rewardZ,
    );
  }

  @Get('milestones')
  async getAllMilestones() {
    return this.milestoneRewardService.getAllMilestones();
  }
}
