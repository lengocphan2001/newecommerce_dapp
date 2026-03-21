/**
 * Script tạo thông tin đăng nhập Web2 cho toàn bộ user hiện có.
 * - User đã có username: giữ nguyên username, tạo password ngẫu nhiên mới.
 * - User chưa có username: tự generate username unique + tạo password ngẫu nhiên.
 *
 * Sau khi chạy, user có thể login bằng username + password (route username-login).
 *
 * Usage (từ thư mục backend):
 *   npm run script:set-passwords
 *
 * Hoặc:
 *   npx ts-node -r tsconfig-paths/register scripts/set-passwords-for-existing-users.ts
 *
 * Output: backend/scripts/output-existing-users-passwords.csv
 */

import { DataSource, Repository } from 'typeorm';
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

function normalizeUsernameSeed(input: string): string {
  const noDiacritics = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return noDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);
}

async function ensureUniqueUsername(
  userRepo: Repository<User>,
  desired: string,
): Promise<string> {
  const base = (desired && desired.trim()) || 'user';
  let candidate = base;
  let suffix = 0;
  while (true) {
    const existing = await userRepo.findOne({
      where: { username: candidate },
      select: ['id'],
    });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`.slice(0, 24);
  }
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
      select: ['id', 'username', 'email', 'fullName', 'walletAddress'],
    });

    if (users.length === 0) {
      console.log('No users found. Exiting.');
      await dataSource.destroy();
      return;
    }

    console.log(
      `Found ${users.length} users. Generating username/password for Web2 login...`,
    );

    const rows: string[][] = [['username', 'email', 'fullName', 'password']];

    for (const user of users) {
      let username = (user.username || '').trim();
      if (!username) {
        const seed =
          normalizeUsernameSeed(user.fullName || '') ||
          normalizeUsernameSeed((user.email || '').split('@')[0] || '') ||
          normalizeUsernameSeed(user.walletAddress || '') ||
          `user${user.id.replace(/-/g, '').slice(0, 6)}`;
        username = await ensureUniqueUsername(userRepo, seed);
      }

      const plainPassword = generateRandomPassword();
      const hashed = await bcrypt.hash(plainPassword, 10);
      await userRepo.update(user.id, { username, password: hashed });

      rows.push([
        escapeCsv(username),
        escapeCsv(user.email ?? ''),
        escapeCsv(user.fullName ?? ''),
        escapeCsv(plainPassword),
      ]);
    }

    const outPath = path.join(__dirname, 'output-existing-users-passwords.csv');
    const csvContent = rows.map((row) => row.join(',')).join('\n');
    const BOM = '\uFEFF';
    fs.writeFileSync(outPath, BOM + csvContent, 'utf8');

    console.log(`Done. Usernames/passwords updated in DB. CSV written to: ${outPath}`);
    console.log('Send this file to users (or import and email them). Keep the file secure and delete after distribution.');

    await dataSource.destroy();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
