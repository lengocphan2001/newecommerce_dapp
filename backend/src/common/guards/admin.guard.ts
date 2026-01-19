import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Allow staff (type === 'staff') or users with isAdmin flag
    if (!user?.isAdmin && user?.type !== 'staff') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}


