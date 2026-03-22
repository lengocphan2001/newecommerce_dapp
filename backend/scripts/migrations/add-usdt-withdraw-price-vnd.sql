-- USDT→VND rate for withdraw display (separate from usdtPriceVnd for deposit/checkout).
-- Run once on MySQL when synchronize is disabled, e.g.:
--   mysql -u USER -p DB_NAME < backend/scripts/migrations/add-usdt-withdraw-price-vnd.sql

ALTER TABLE `banking_config`
  ADD COLUMN `usdtWithdrawPriceVnd` DECIMAL(14, 2) NULL DEFAULT NULL
  AFTER `usdtPriceVnd`;
