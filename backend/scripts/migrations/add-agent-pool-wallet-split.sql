-- Agent pool rewards are now split across two wallets instead of being paid
-- entirely into the withdraw wallet: 70% withdraw wallet, 20% reconsumption
-- wallet, the remaining 10% is tax/VAT that is deducted and never credited.
-- The exact percentages come from system_config
-- (commissionWithdrawWalletPercent / commissionDepositWalletPercent).
--
-- These columns record, per payout row, how much actually landed in each
-- wallet. rewardAmount keeps holding the gross reward.

ALTER TABLE `agent_pool_histories`
  ADD COLUMN `withdrawAmount` DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER `rewardAmount`,
  ADD COLUMN `reconsumptionAmount` DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER `withdrawAmount`,
  ADD COLUMN `taxAmount` DECIMAL(18,4) NOT NULL DEFAULT 0 AFTER `reconsumptionAmount`;

-- Rows created before this change credited 100% of rewardAmount to the
-- withdraw wallet, so backfill them that way to keep the history truthful.
UPDATE `agent_pool_histories`
SET `withdrawAmount` = `rewardAmount`,
    `reconsumptionAmount` = 0,
    `taxAmount` = 0
WHERE `withdrawAmount` = 0
  AND `reconsumptionAmount` = 0
  AND `taxAmount` = 0;
