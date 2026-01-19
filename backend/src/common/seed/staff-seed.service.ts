import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../../staff/entities/staff.entity';
import * as bcrypt from 'bcryptjs';

/**
 * Code-based seed: ensures there is at least one super admin staff account.
 *
 * NOTE: Change these defaults before deploying anywhere public.
 */
const DEFAULT_SUPER_ADMIN_EMAIL = 'superadmin@example.com';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'superadmin123';
const DEFAULT_SUPER_ADMIN_FULLNAME = 'Super Admin';

@Injectable()
export class StaffSeedService {
  private readonly logger = new Logger(StaffSeedService.name);

  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  async seed() {
    const existingStaff = await this.staffRepository.findOne({
      where: { email: DEFAULT_SUPER_ADMIN_EMAIL },
    });

    if (existingStaff) {
      if (!existingStaff.isSuperAdmin) {
        existingStaff.isSuperAdmin = true;
        existingStaff.status = 'ACTIVE';
        await this.staffRepository.save(existingStaff);
        this.logger.log(`Staff promoted to super admin: ${DEFAULT_SUPER_ADMIN_EMAIL}`);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_SUPER_ADMIN_PASSWORD, 10);

    const staff = this.staffRepository.create({
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      password: hashedPassword,
      fullName: DEFAULT_SUPER_ADMIN_FULLNAME,
      status: 'ACTIVE',
      isSuperAdmin: true,
    });

    await this.staffRepository.save(staff);

    this.logger.log('Default super admin staff created:');
    this.logger.log(`Email: ${DEFAULT_SUPER_ADMIN_EMAIL}`);
    this.logger.warn(`Password: ${DEFAULT_SUPER_ADMIN_PASSWORD}`);
  }
}
