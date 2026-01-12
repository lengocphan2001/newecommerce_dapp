import { Controller, Get, Put, Body, Param, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  async getUsers(@Query() query: any) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id/detail')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Get('orders')
  async getOrders(@Query() query: any) {
    return this.adminService.getOrders(query);
  }

  @Put('users/:id/status')
  async updateUserStatus(@Param('id') id: string, @Body() statusDto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, statusDto);
  }
}

