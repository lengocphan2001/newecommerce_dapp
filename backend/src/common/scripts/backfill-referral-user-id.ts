/**
 * Script để backfill referralUserId cho các user hiện có
 * Chạy script này một lần sau khi thêm field referralUserId vào User entity
 * 
 * Usage:
 *   ts-node src/common/scripts/backfill-referral-user-id.ts
 */

import { DataSource } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function backfillReferralUserId() {
  const dbType = process.env.DB_TYPE || 'postgres';
  const defaultPort = dbType === 'mysql' ? 3306 : 5432;
  
  const dataSource = new DataSource({
    type: dbType as any,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : defaultPort,
    username:
      process.env.DB_USERNAME ||
      (dbType === 'mysql' ? 'root' : 'postgres'),
    password:
      process.env.DB_PASSWORD ||
      (dbType === 'mysql' ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: [User],
    synchronize: false, // Don't sync, just query
    logging: true,
  });

  try {
    await dataSource.initialize();

    const userRepository = dataSource.getRepository(User);

    // Lấy tất cả users có referralUser (username) nhưng chưa có referralUserId
    const usersToUpdate = await userRepository
      .createQueryBuilder('user')
      .where('user.referralUser IS NOT NULL')
      .andWhere('(user.referralUserId IS NULL OR user.referralUserId = "")')
      .getMany();


    let updatedCount = 0;
    let skippedCount = 0;

    for (const user of usersToUpdate) {
      // Nếu đã có referralUserId, skip
      if (user.referralUserId) {
        skippedCount++;
        continue;
      }

      // Tìm referral user từ username
      if (user.referralUser) {
        const referralUser = await userRepository.findOne({
          where: { username: user.referralUser },
        });

        if (referralUser) {
          // Cập nhật referralUserId
          await userRepository.update(user.id, {
            referralUserId: referralUser.id,
          });
          updatedCount++;
        } else {
          // Skipped user - referral user not found
          skippedCount++;
        }
      }
    }


    await dataSource.destroy();
  } catch (error) {
    await dataSource.destroy();
    process.exit(1);
  }
}

// Run script
backfillReferralUserId();
