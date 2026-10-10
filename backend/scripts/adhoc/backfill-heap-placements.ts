/**
 * Put existing users into the Heap pools the current rules give them, for
 * users who qualified before those rules existed:
 *   - by lifetime purchase total (users.totalPurchaseAmount):
 *     >= 2400 → pools 100, 500, 2400; >= 500 → 100, 500; >= 100 → 100
 *   - a manually assigned rank (users.manualRank other than NONE) → 100, 500
 *
 * Only pools the user never had a placement in are added, without a trigger
 * order. Joining pays nobody: members start receiving from the next orders.
 *
 * Usage:
 *   npm run script:backfill-heap-placements            # dry run
 *   npm run script:backfill-heap-placements -- --apply # execute
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/user/entities/user.entity';
import { HeapRewardPlacement } from '../../src/heap-reward/entities/heap-reward-placement.entity';
import {
  HeapRewardService,
  MANUAL_RANK_HEAP_POOLS,
  heapPoolsForAmount,
} from '../../src/heap-reward/heap-reward.service';

async function main() {
  const apply = process.argv.includes('--apply');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);
    const heapRewardService = app.get(HeapRewardService);

    const users = await dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .select(['u.id', 'u.username', 'u.totalPurchaseAmount', 'u.manualRank'])
      .where('u.totalPurchaseAmount >= :min', { min: 100 })
      .orWhere("(u.manualRank IS NOT NULL AND u.manualRank <> 'NONE')")
      .getMany();

    const placements = await dataSource
      .getRepository(HeapRewardPlacement)
      .createQueryBuilder('p')
      .select(['p.userId', 'p.poolLevel'])
      .getMany();
    const had = new Set(placements.map((p) => `${p.userId}:${p.poolLevel}`));

    let usersTouched = 0;
    const perPool: Record<number, number> = { 100: 0, 500: 0, 2400: 0 };

    for (const user of users) {
      const pools = new Set(heapPoolsForAmount(Number(user.totalPurchaseAmount) || 0));
      if (user.manualRank && user.manualRank !== 'NONE') {
        MANUAL_RANK_HEAP_POOLS.forEach((p) => pools.add(p));
      }
      const missing = [...pools].filter((p) => !had.has(`${user.id}:${p}`)).sort((a, b) => a - b);
      if (!missing.length) continue;

      usersTouched++;
      missing.forEach((p) => perPool[p]++);
      console.log(
        `${user.username ?? user.id}: total ${Number(user.totalPurchaseAmount) || 0}, ` +
          `manualRank ${user.manualRank ?? 'NONE'} → pools ${missing.join(', ')}`,
      );
      if (apply) {
        await heapRewardService.addMissingPlacements(user.id, missing, 'backfill');
      }
    }

    console.log(
      `${apply ? 'Added' : 'Would add'} placements for ${usersTouched} users: ` +
        `pool 100: ${perPool[100]}, pool 500: ${perPool[500]}, pool 2400: ${perPool[2400]}.`,
    );
    if (!apply) console.log('Dry run. Re-run with --apply to write.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
