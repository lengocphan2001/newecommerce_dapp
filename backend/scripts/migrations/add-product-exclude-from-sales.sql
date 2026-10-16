-- MySQL version. See add-product-exclude-from-sales.postgres.sql for PostgreSQL.
--
-- Products flagged excludeFromSales still earn commission as usual, but orders
-- for them no longer count towards personal, branch or group sales.
-- Existing products default to false, so nothing changes until an admin turns
-- the flag on.

ALTER TABLE `products`
  ADD COLUMN `excludeFromSales` TINYINT(1) NOT NULL DEFAULT 0 AFTER `isPromisingProduct`;
