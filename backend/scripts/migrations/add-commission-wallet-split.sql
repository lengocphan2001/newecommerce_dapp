-- MySQL version. See add-commission-wallet-split.postgres.sql for PostgreSQL.
--
-- Commissions now record, when paid, how much went to the withdraw wallet, how
-- much to the reconsumption wallet and how much was kept as tax, like agent
-- pool rewards and salaries already do. The "Thống kê trả thưởng" admin page
-- reads these columns.
--
-- Commissions paid before this change are backfilled from the percentages the
-- batch payout wrote into their notes, by
--   npm run script:backfill-commission-wallet-split -- --apply
--
-- The createdAt indexes let the report filter each reward table by date.
-- MySQL has no CREATE INDEX IF NOT EXISTS: skip any index SHOW INDEX already lists.

ALTER TABLE `commissions`
  ADD COLUMN `withdrawAmount` DECIMAL(36,18) NOT NULL DEFAULT 0 AFTER `orderAmount`,
  ADD COLUMN `reconsumptionAmount` DECIMAL(36,18) NOT NULL DEFAULT 0 AFTER `withdrawAmount`,
  ADD COLUMN `taxAmount` DECIMAL(36,18) NOT NULL DEFAULT 0 AFTER `reconsumptionAmount`;

CREATE INDEX `IDX_commissions_createdAt` ON `commissions` (`createdAt`);
CREATE INDEX `IDX_heap_reward_histories_createdAt` ON `heap_reward_histories` (`createdAt`);
CREATE INDEX `IDX_matrix_reward_ledger_createdAt` ON `matrix_reward_ledger` (`createdAt`);
CREATE INDEX `IDX_agent_pool_histories_createdAt` ON `agent_pool_histories` (`createdAt`);
