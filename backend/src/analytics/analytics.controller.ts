import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('overview')
    getOverview() {
        return this.analyticsService.getOverview();
    }

    @Get('revenue-chart')
    getRevenueChart(@Query('days') days?: number) {
        return this.analyticsService.getRevenueChart(days ? Number(days) : 7);
    }

    @Get('order-chart')
    getOrderChart(@Query('days') days?: number) {
        return this.analyticsService.getOrderChart(days ? Number(days) : 7);
    }

    @Get('user-growth')
    getUserGrowth(@Query('days') days?: number) {
        return this.analyticsService.getUserGrowth(days ? Number(days) : 7);
    }

    @Get('top-products')
    getTopProducts(@Query('limit') limit?: number) {
        return this.analyticsService.getTopProducts(limit ? Number(limit) : 5);
    }
}
