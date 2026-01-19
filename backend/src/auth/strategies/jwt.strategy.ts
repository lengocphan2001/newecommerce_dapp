import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service';
import { StaffService } from '../../staff/staff.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private staffService: StaffService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    // Check if it's a staff token
    if (payload.type === 'staff' || payload.staffId) {
      const staff = await this.staffService.findOne(payload.sub);
      if (!staff || staff.status !== 'ACTIVE') {
        throw new UnauthorizedException();
      }
      return {
        sub: staff.id,
        staffId: staff.id,
        userId: staff.id,
        email: staff.email,
        isAdmin: true,
        isSuperAdmin: staff.isSuperAdmin,
        type: 'staff',
      };
    }

    // Regular user token
    const user = await this.userService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      sub: user.id,
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      type: 'user',
    };
  }
}

