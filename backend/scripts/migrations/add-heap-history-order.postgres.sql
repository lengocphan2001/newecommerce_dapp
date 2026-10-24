-- PostgreSQL version. See add-heap-history-order.sql for MySQL.
--
-- Heap rewards are shared among the members already in a pool, so a history row
-- belongs to the member's placement, not to the order that paid it. Record the
-- order, whether the reward pushed the placement out of the pool, and whether
-- the wallet was actually credited (simulated syncs skip it). Deleting an order
-- uses them to take back the heap rewards it paid out.
--
-- Older rows keep orderId NULL: their order is unknown, so deleting an order
-- does not take them back.

ALTER TABLE "heap_reward_histories"
  ADD COLUMN IF NOT EXISTS "orderId" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS "pushedOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "walletCredited" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "IDX_heap_reward_histories_orderId" ON "heap_reward_histories" ("orderId");
