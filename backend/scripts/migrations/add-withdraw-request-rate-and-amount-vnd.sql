-- Add rate and amountVnd to wallet_withdraw_requests for static history values.
-- Run once on MySQL when TypeORM synchronize is disabled:
--   mysql -u USER -p DB_NAME < backend/scripts/migrations/add-withdraw-request-rate-and-amount-vnd.sql

ALTER TABLE `wallet_withdraw_requests`
  ADD COLUMN `rate` DECIMAL(14, 2) NULL DEFAULT NULL AFTER `actualAmount`,
  ADD COLUMN `amountVnd` DECIMAL(36, 2) NULL DEFAULT NULL AFTER `rate`;
