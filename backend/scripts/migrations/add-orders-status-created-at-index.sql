-- Indexes for monthly reward calculation and admin dashboard queries.
-- Both filter orders by status and/or a createdAt range; without these the
-- queries scan the whole `orders` table.
--
-- MySQL has no "CREATE INDEX IF NOT EXISTS". Run `SHOW INDEX FROM orders;`
-- first and skip any statement whose index already exists.

CREATE INDEX `IDX_orders_status_created_at` ON `orders` (`status`, `createdAt`);
CREATE INDEX `IDX_orders_created_at` ON `orders` (`createdAt`);
