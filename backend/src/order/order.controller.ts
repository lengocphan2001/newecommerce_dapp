import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { JwtAuthGuard } from '../common/guards';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: any, @Request() req: any) {
    // Admin có thể xem tất cả, user chỉ xem của mình
    if (!req.user.isAdmin) {
      query.userId = req.user.userId || req.user.sub;
    }
    return this.orderService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const order = await this.orderService.findOne(id);
    // User chỉ có thể xem đơn hàng của mình (trừ admin)
    if (!req.user.isAdmin && order.userId !== (req.user.userId || req.user.sub)) {
      throw new Error('Unauthorized');
    }
    return order;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req: any) {
    const userId = req.user.userId || req.user.sub;
    return this.orderService.create(createOrderDto, userId);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateOrderStatusDto, @Request() req: any) {
    // Only admin can update order status
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized: Only admin can update order status');
    }
    return this.orderService.updateStatus(id, updateStatusDto);
  }

  @Post(':id/cancel')
  async cancelOrder(@Param('id') id: string) {
    return this.orderService.cancelOrder(id);
  }
}

