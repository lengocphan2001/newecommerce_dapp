import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('roles.view')
  findAll() {
    return this.permissionService.findAll();
  }

  @Get('module/:module')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('roles.view')
  findByModule(@Param('module') module: string) {
    return this.permissionService.findByModule(module);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('roles.view')
  findOne(@Param('id') id: string) {
    return this.permissionService.findOne(id);
  }
}
