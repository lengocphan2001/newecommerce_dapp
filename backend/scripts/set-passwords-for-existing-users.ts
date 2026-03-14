/**
 * Script tạo mật khẩu đăng nhập cho toàn bộ user hiện có (Web2 migration).
 * Mỗi user có username sẽ được gán một mật khẩu ngẫu nhiên (12 ký tự), hash lưu DB,
 * và file CSV được xuất ra để admin gửi cho user (username, email, password).
 *
 * Chạy một lần sau khi chuyển sang Web2. User đăng nhập bằng username + password.
 *
 * Usage (từ thư mục backend):
 *   npm run script:set-passwords
 *
 * Hoặc:
 *   npx ts-node -r tsconfig-paths/register scripts/set-passwords-for-existing-users.ts
 *
 * Output: backend/scripts/output-existing-users-passwords.csv
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../src/user/entities/user.entity';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const PASSWORD_LENGTH = 12;

function generateRandomPassword(): string {
  let result = '';
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return result;
}

function escapeCsv(val: string | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  const dbType = (process.env.DB_TYPE || 'postgres') as any;
  const isMySQL = dbType === 'mysql';

  const dataSource = new DataSource({
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: [User],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    const userRepo = dataSource.getRepository(User);

    const users = await userRepo.find({
      where: [],
      select: ['id', 'username', 'email', 'fullName'],
    });

    const withUsername = users.filter((u) => u.username && String(u.username).trim());
    if (withUsername.length === 0) {
      console.log('No users with username found. Exiting.');
      await dataSource.destroy();
      return;
    }

    console.log(`Found ${withUsername.length} users with username. Generating passwords...`);

    const rows: string[][] = [['username', 'email', 'fullName', 'password']];

    for (const user of withUsername) {
      const plainPassword = generateRandomPassword();
      const hashed = await bcrypt.hash(plainPassword, 10);
      await userRepo.update(user.id, { password: hashed });

      rows.push([
        escapeCsv(user.username ?? ''),
        escapeCsv(user.email ?? ''),
        escapeCsv(user.fullName ?? ''),
        escapeCsv(plainPassword),
      ]);
    }

    const outPath = path.join(__dirname, 'output-existing-users-passwords.csv');
    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    fs.writeFileSync(outPath, BOM + csvContent, 'utf8');

    console.log(`Done. Passwords updated in DB. CSV written to: ${outPath}`);
    console.log('Send this file to users (or import and email them). Keep the file secure and delete after distribution.');

    await dataSource.destroy();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
