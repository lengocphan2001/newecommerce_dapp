import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { MatrixRewardService } from './matrix-reward.service';

@Controller('admin/matrix-reward')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MatrixRewardAdminController {
  constructor(private readonly matrixRewardService: MatrixRewardService) {}

  @Get('config')
  getConfig() {
    return this.matrixRewardService.getAdminConfig();
  }

  @Put('config')
  setConfig(
    @Body()
    body: {
      minOrderUsd?: number;
      perSlotUsd?: number;
      maxEarnPerTreeUsd?: number;
      maxUplines?: number;
    },
  ) {
    return this.matrixRewardService.setAdminConfig(body);
  }

  @Get('trees/levels')
  listLevels() {
    return this.matrixRewardService.listTreeLevels();
  }

  @Get('trees/:level/view')
  getTreeView(@Param('level', ParseIntPipe) level: number) {
    return this.matrixRewardService.getTreeViewForLevel(level);
  }
}
