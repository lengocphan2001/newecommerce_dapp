import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto';
import { JwtAuthGuard } from '../common/guards';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: any, @Request() req: any) {
    // Admin có thể xem tất cả, user chỉ xem của mình
    if (!req.user.isAdmin) {
      query.userId = req.user.userId || req.user.sub;
    }
    return this.orderService.findAll(query);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportOrders(
    @Query() query: any,
    @Request() req: any,
    @Res() res: Response,
  ) {
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized');
    }
    const orders = await this.orderService.findAll(query);
    const headers = [
      'Order ID',
      'User ID',
      'Username',
      'Full Name',
      'Phone Number',
      'Total Amount',
      'Status',
      'Items',
      'Product IDs',
      'Shipping Address',
      'Transaction Hash',
      'Shipping Fee',
      'VAT Rate',
      'VAT Amount',
      'Created At',
      'Updated At',
    ];
    const escapeCsv = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = (orders || []).map((order: any) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsString = items
        .map((item: any) => {
          let itemStr = `${item.productName || ''} (x${item.quantity || 0})`;
          if (item.properties && Object.keys(item.properties).length > 0) {
            const propsStr = Object.entries(item.properties)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ');
            itemStr += ` [${propsStr}]`;
          }
          return itemStr;
        })
        .join(', ');
      const productIdsString = items
        .map((item: any) => item.productId || '')
        .filter(Boolean)
        .join(', ');
      return [
        escapeCsv(order.id),
        escapeCsv(order.userId),
        escapeCsv(order.user?.username || ''),
        escapeCsv(order.shippingName ?? order.user?.fullName ?? ''),
        escapeCsv(order.shippingPhone ?? order.user?.phone ?? ''),
        escapeCsv(order.totalAmount ?? 0),
        escapeCsv(order.status ?? ''),
        escapeCsv(itemsString),
        escapeCsv(productIdsString),
        escapeCsv(order.shippingAddress ?? ''),
        escapeCsv(order.transactionHash ?? ''),
        escapeCsv(order.shippingFee ?? 0),
        escapeCsv(order.vatRate ?? 8),
        escapeCsv(order.vatAmount ?? 0),
        escapeCsv(order.createdAt),
        escapeCsv(order.updatedAt),
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((row: string[]) => row.join(','))].join('\n');
    const BOM = '\uFEFF';
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename="orders.csv"');
    return res.send(BOM + csvContent);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Request() req: any) {
    const order = await this.orderService.findOne(id);
    // User chỉ có thể xem đơn hàng của mình (trừ admin)
    if (
      !req.user.isAdmin &&
      order.userId !== (req.user.userId || req.user.sub)
    ) {
      throw new Error('Unauthorized');
    }
    return order;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createOrderDto: CreateOrderDto, @Request() req: any) {
    const userId = req.user.userId || req.user.sub;
    const order = await this.orderService.create(createOrderDto, userId);

    // Notify all connected staff about new order
    this.notificationsGateway.notifyNewOrder(order);

    return order;
  }

  @Post('guest')
  async createGuest(@Body() createOrderDto: CreateOrderDto) {
    // Khách vãng lai mua hàng không cần đăng nhập, nên userId sẽ là undefined
    const order = await this.orderService.create(createOrderDto, undefined);

    // Notify all connected staff about new order
    this.notificationsGateway.notifyNewOrder(order);

    return order;
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Request() req: any,
  ) {
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
  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  async confirmPayment(
    @Param('id') id: string,
    @Body('transactionHash') transactionHash: string,
    @Request() req: any,
  ) {
    if (!transactionHash) {
      throw new Error('Transaction hash is required');
    }
    const userId = req.user.userId || req.user.sub;
    return this.orderService.confirmPayment(id, transactionHash, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteOrderAndRollback(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    if (!req.user.isAdmin) {
      throw new Error('Unauthorized: Only admin can delete and rollback orders');
    }
    await this.orderService.deleteOrderAndRollback(id);
    return { success: true, message: 'Đơn hàng và các hoa hồng/doanh số liên quan đã được xóa và thu hồi thành công.' };
  }
}
