/**
 * Backfill the wallet split (withdrawAmount / reconsumptionAmount / taxAmount)
 * of commissions paid before those columns existed.
 *
 * The batch payout wrote the percentages it used into the commission notes
 * ("Distributed: withdraw wallet (70%), reconsumption wallet (20%), tax (10%)"),
 * so the split is recomputed from them. Paid commissions without such a note
 * (on-chain payouts, manual approval) credited no internal wallet and keep 0.
 *
 * Run after scripts/migrations/add-commission-wallet-split(.postgres).sql.
 *
 * Usage:
 *   npm run script:backfill-commission-wallet-split            # dry run
 *   npm run script:backfill-commission-wallet-split -- --apply # execute
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  Commission,
  CommissionStatus,
} from '../../src/affiliate/entities/commission.entity';
import {
  parseDistributedNote,
  splitCommissionAmount,
} from '../../src/affiliate/commission-wallet-split';

const PAGE_SIZE = 500;

async function main() {
  const apply = process.argv.includes('--apply');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const repo = app.get(DataSource).getRepository(Commission);

    let updated = 0;
    let withoutNote = 0;
    // Lowest uuid, valid both as a Postgres uuid and as a MySQL varchar.
    let lastId = '00000000-0000-0000-0000-000000000000';

    // Keyset pagination on id, so rows updated along the way do not shift pages.
    for (;;) {
      const page = await repo
        .createQueryBuilder('c')
        .select(['c.id', 'c.amount', 'c.notes'])
        .where('c.status = :paid', { paid: CommissionStatus.PAID })
        .andWhere('c.withdrawAmount = 0')
        .andWhere('c.reconsumptionAmount = 0')
        .andWhere('c.taxAmount = 0')
        .andWhere('c.id > :lastId', { lastId })
        .orderBy('c.id', 'ASC')
        .take(PAGE_SIZE)
        .getMany();
      if (page.length === 0) break;
      lastId = page[page.length - 1].id;

      for (const c of page) {
        const percents = parseDistributedNote(c.notes);
        if (!percents) {
          withoutNote++;
          continue;
        }
        const split = splitCommissionAmount(
          c.amount,
          percents.withdrawPercent,
          percents.reconsumptionPercent,
        );
        if (apply) await repo.update(c.id, split);
        updated++;
      }
    }

    console.log(
      `${apply ? 'Updated' : 'Would update'} ${updated} paid commissions; ` +
        `${withoutNote} paid commissions have no wallet distribution note and keep 0.`,
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
