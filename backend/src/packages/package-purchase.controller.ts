import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards, BadRequestException } from '@nestjs/common';
import { PackagePurchaseService } from './package-purchase.service';
import { JwtAuthGuard, AdminGuard } from '../common/guards';
import { PackagePurchaseStatus } from './entities/package-purchase.entity';

@Controller('package-purchases')
export class PackagePurchaseController {
  constructor(private readonly purchaseService: PackagePurchaseService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() body: { packageId: string }) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.purchaseService.create(userId, body.packageId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMy(@Request() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.purchaseService.findMyPurchases(userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllAdmin(@Query('status') status?: PackagePurchaseStatus) {
    return this.purchaseService.findAllAdmin(status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOne(@Param('id') id: string) {
    return this.purchaseService.findOne(id);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async confirm(@Param('id') id: string) {
    return this.purchaseService.confirm(id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async reject(@Param('id') id: string) {
    return this.purchaseService.reject(id);
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(@Request() req: any, @Param('id') id: string, @Body() body: { transactionHash: string }) {
    const userId = req.user?.userId ?? req.user?.id;
    if (!body.transactionHash?.trim()) {
      throw new BadRequestException('transactionHash is required');
    }
    return this.purchaseService.confirmPaymentByUser(userId, id, body.transactionHash.trim());
  }
}
