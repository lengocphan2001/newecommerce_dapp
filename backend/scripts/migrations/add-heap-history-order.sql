-- MySQL version. See add-heap-history-order.postgres.sql for PostgreSQL.
--
-- Heap rewards are shared among the members already in a pool, so a history row
-- belongs to the member's placement, not to the order that paid it. Record the
-- order, whether the reward pushed the placement out of the pool, and whether
-- the wallet was actually credited (simulated syncs skip it). Deleting an order
-- uses them to take back the heap rewards it paid out.
--
-- Older rows keep orderId NULL: their order is unknown, so deleting an order
-- does not take them back.

ALTER TABLE `heap_reward_histories`
  ADD COLUMN `orderId` VARCHAR(255) NULL AFTER `rewardDate`,
  ADD COLUMN `pushedOut` TINYINT NOT NULL DEFAULT 0 AFTER `orderId`,
  ADD COLUMN `walletCredited` TINYINT NOT NULL DEFAULT 1 AFTER `pushedOut`;

CREATE INDEX `IDX_heap_reward_histories_orderId` ON `heap_reward_histories` (`orderId`);
