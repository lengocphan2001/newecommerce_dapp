import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { MatrixRewardService } from './matrix-reward.service';

@Controller('matrix-reward')
@UseGuards(JwtAuthGuard)
export class MatrixRewardUserController {
  constructor(private readonly matrixRewardService: MatrixRewardService) {}

  @Get('config')
  getConfig() {
    return this.matrixRewardService.getPublicConfig();
  }

  @Get('me')
  getMe(@Request() req: { user: { sub: string } }) {
    return this.matrixRewardService.getMySummary(req.user.sub);
  }
}
