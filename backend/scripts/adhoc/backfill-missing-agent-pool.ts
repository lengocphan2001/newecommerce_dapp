/**
 * Backfill agent pool payouts for orders that lost one or more pools.
 *
 * A deadlock in one pool's transaction used to abort the whole distribution
 * loop, so confirmed orders can be missing rows in agent_pool_histories for
 * some pools while other pools were paid. AgentPoolService.processOrder is
 * idempotent per (order, pool), so replaying it only fills the gaps.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/adhoc/backfill-missing-agent-pool.ts          # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/adhoc/backfill-missing-agent-pool.ts --apply  # execute
 *   ... --since=2026-08-01   # only orders confirmed/created on or after this date
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AgentPoolService } from '../../src/agent-pool/agent-pool.service';
import { AgentPool } from '../../src/agent-pool/entities/agent-pool.entity';
import { AgentPoolHistory } from '../../src/agent-pool/entities/agent-pool-history.entity';
import { AgentPoolMember } from '../../src/agent-pool/entities/agent-pool-member.entity';
import { Order, OrderStatus } from '../../src/order/entities/order.entity';

// Orders in these states have been approved, so their pools should be paid.
const PAID_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const since = sinceArg ? new Date(sinceArg.split('=')[1]) : null;
  if (since && isNaN(since.getTime())) {
    throw new Error('--since must be a valid date, e.g. --since=2026-08-01');
  }
  return { apply, since };
}

async function main() {
  const { apply, since } = parseArgs();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);
    const agentPoolService = app.get(AgentPoolService);

    const poolRepo = dataSource.getRepository(AgentPool);
    const memberRepo = dataSource.getRepository(AgentPoolMember);
    const historyRepo = dataSource.getRepository(AgentPoolHistory);
    const orderRepo = dataSource.getRepository(Order);

    const activePools = await poolRepo.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });

    // A pool with no active member never produces history, so its absence is
    // not a gap. Only pools that can actually pay are checked.
    const payablePools: AgentPool[] = [];
    for (const pool of activePools) {
      const memberCount = await memberRepo.count({
        where: { poolId: pool.id, isActive: true },
      });
      if (Number(pool.percent) > 0 && memberCount > 0) payablePools.push(pool);
      else
        console.log(
          `Pool ${pool.code}: percent=${pool.percent}, active members=${memberCount} — not payable, skipped.`,
        );
    }

    if (payablePools.length === 0) {
      console.log('No payable pools configured. Nothing to backfill.');
      return;
    }

    const qb = orderRepo
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', { statuses: PAID_STATUSES })
      .orderBy('o.createdAt', 'ASC');
    if (since) qb.andWhere('o.createdAt >= :since', { since });

    const orders = await qb.getMany();
    console.log(
      `Checking ${orders.length} approved orders against ${payablePools.length} payable pools (${payablePools
        .map((p) => p.code)
        .join(', ')}). Mode: ${apply ? 'APPLY' : 'DRY RUN'}.`,
    );

    let gapOrders = 0;
    let processed = 0;

    for (const order of orders) {
      const net =
        Math.max(
          0,
          (Number(order.totalAmount) || 0) -
            (Number(order.vatAmount) || 0) -
            (Number(order.shippingFee) || 0),
        );
      if (net <= 0) continue;

      const paidPoolIds = new Set(
        (
          await historyRepo
            .createQueryBuilder('h')
            .select('DISTINCT h.poolId', 'poolId')
            .where('h.orderId = :orderId', { orderId: order.id })
            .getRawMany()
        ).map((r: any) => r.poolId),
      );

      // Orders processed before a pool existed are not gaps either: skip an
      // order that has no history at all only when it predates every pool.
      const missing = payablePools.filter(
        (p) => !paidPoolIds.has(p.id) && p.createdAt <= order.createdAt,
      );
      if (missing.length === 0) continue;

      gapOrders += 1;
      console.log(
        `Order ${order.id} (${order.createdAt.toISOString()}) missing pools: ${missing
          .map((p) => p.code)
          .join(', ')}`,
      );

      if (apply) {
        await agentPoolService.processOrder(order.id);
        processed += 1;
      }
    }

    console.log(
      `Done. Orders with gaps: ${gapOrders}. Orders reprocessed: ${processed}.${
        apply ? '' : ' Re-run with --apply to execute.'
      }`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
