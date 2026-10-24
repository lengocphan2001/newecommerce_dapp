-- PostgreSQL version. See add-product-exclude-from-sales.sql for MySQL.
--
-- Products flagged excludeFromSales still earn commission as usual, but orders
-- for them no longer count towards personal, branch or group sales.
-- Existing products default to false, so nothing changes until an admin turns
-- the flag on.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "excludeFromSales" BOOLEAN NOT NULL DEFAULT FALSE;
