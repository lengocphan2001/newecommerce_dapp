import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../../user/user.service';

/**
 * Code-based seed (no ENV required): ensures there is at least one admin account.
 *
 * NOTE: Change these defaults before deploying anywhere public.
 */
const DEFAULT_ADMIN_EMAIL = 'admin@example.com';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_ADMIN_FULLNAME = 'Admin User';

@Injectable()
export class AdminSeedService {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(private readonly userService: UserService) {}

  async seed() {
    const existingUser = await this.userService.findByEmail(DEFAULT_ADMIN_EMAIL);

    if (existingUser) {
      if (!existingUser.isAdmin) {
        await this.userService.update(existingUser.id, { isAdmin: true, status: 'ACTIVE' });
        this.logger.log(`User promoted to admin: ${DEFAULT_ADMIN_EMAIL}`);
      }
      return;
    }

    await this.userService.create({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      fullName: DEFAULT_ADMIN_FULLNAME,
      isAdmin: true,
      status: 'ACTIVE',
    });

    this.logger.log('Default admin user created:');
    this.logger.log(`Email: ${DEFAULT_ADMIN_EMAIL}`);
    this.logger.warn(`Password: ${DEFAULT_ADMIN_PASSWORD}`);
  }
}


