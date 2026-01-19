import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector, ModuleRef } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { StaffService } from '../../staff/staff.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user is staff (not regular user)
    if (!user.staffId) {
      throw new ForbiddenException('Staff access required');
    }

    // Super admin has all permissions
    if (user.isSuperAdmin) {
      return true;
    }

    // Get StaffService dynamically to avoid circular dependency
    const staffService = this.moduleRef.get(StaffService, { strict: false });

    // Check if staff has all required permissions
    for (const permission of requiredPermissions) {
      const hasPermission = await staffService.hasPermission(
        user.staffId,
        permission,
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permission required: ${permission}`,
        );
      }
    }

    return true;
  }
}
