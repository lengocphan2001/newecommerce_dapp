import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('staffs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('staffs.create')
  async create(@Body() createStaffDto: CreateStaffDto, @Request() req) {
    return this.staffService.create(createStaffDto, req.user.staffId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('staffs.view')
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('staffs.view')
  findOne(@Param('id') id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('staffs.update')
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
    return this.staffService.update(id, updateStaffDto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('staffs.delete')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
