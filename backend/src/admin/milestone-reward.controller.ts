import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
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
}
