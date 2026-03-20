/**
 * Create or update a staff superadmin account (for staff-based admin login).
 *
 * Usage:
 * 1) Env vars:
 *    SUPERADMIN_EMAIL=owner@example.com SUPERADMIN_PASSWORD='StrongPass123' SUPERADMIN_FULL_NAME='Owner Admin' npm run script:create-superadmin
 *
 * 2) CLI args:
 *    npm run script:create-superadmin -- --email=owner@example.com --password='StrongPass123' --fullName='Owner Admin'
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import { Staff } from '../src/staff/entities/staff.entity';
import { Role } from '../src/role/entities/role.entity';
import { Permission } from '../src/permission/entities/permission.entity';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function getArg(name: string): string | undefined {
  const key = `--${name}=`;
  const item = process.argv.find((arg) => arg.startsWith(key));
  return item ? item.slice(key.length) : undefined;
}

async function main() {
  const email = (getArg('email') || process.env.SUPERADMIN_EMAIL || '').trim();
  const password = getArg('password') || process.env.SUPERADMIN_PASSWORD || '';
  const fullName = (
    getArg('fullName') ||
    process.env.SUPERADMIN_FULL_NAME ||
    'Super Admin'
  ).trim();
  const phone = (getArg('phone') || process.env.SUPERADMIN_PHONE || '').trim();

  if (!email) {
    throw new Error(
      'Missing email. Provide --email=... or SUPERADMIN_EMAIL env var.',
    );
  }
  if (!password || password.length < 6) {
    throw new Error(
      'Missing/weak password. Provide --password=... (min 6 chars) or SUPERADMIN_PASSWORD env var.',
    );
  }

  const dbType = (process.env.DB_TYPE || 'postgres') as any;
  const isMySQL = dbType === 'mysql';

  const dataSource = new DataSource({
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: [Staff, Role, Permission],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    const staffRepo = dataSource.getRepository(Staff);
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await staffRepo.findOne({ where: { email } });

    if (existing) {
      await staffRepo.update(existing.id, {
        fullName: fullName || existing.fullName || 'Super Admin',
        phone: phone || existing.phone || undefined,
        password: passwordHash,
        status: 'ACTIVE',
        isSuperAdmin: true,
      });
      console.log(`Updated existing staff as superadmin: ${email}`);
    } else {
      const staff = staffRepo.create({
        email,
        password: passwordHash,
        fullName: fullName || 'Super Admin',
        phone: phone || undefined,
        status: 'ACTIVE',
        isSuperAdmin: true,
      });
      await staffRepo.save(staff);
      console.log(`Created new superadmin staff: ${email}`);
    }

    console.log('Done. Use admin login page with this account.');
    await dataSource.destroy();
  } catch (error) {
    console.error('Failed to create/update superadmin staff:', error);
    process.exit(1);
  }
}

main();
