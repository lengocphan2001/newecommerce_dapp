-- Monthly salary paid to users whose reward sales (weak binary branch sales)
-- for a month reach a salary tier. Tiers are in VND (10M-100M: 4%, 100M-500M:
-- 6%, 500M-1B: 8%, from 1B: 10%), converted with the USDT/VND rate from Banking
-- Settings; the salary is the month's reward sales times the tier rate.
-- Salaries are paid from the 10th of the following month, once per user per
-- month. Each row is paid like an agent pool reward: `amount` is the gross
-- salary, split with the shared wallet distribution (default 70% withdraw
-- wallet, 20% reconsumption wallet, 10% tax credited nowhere).

CREATE TABLE IF NOT EXISTS `salary_payments` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `month` varchar(7) NOT NULL,
  `rewardSales` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `tierMin` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `tierMax` decimal(36,18) NULL,
  `tierCode` varchar(10) NULL,
  `rate` decimal(6,4) NULL,
  `vndRate` decimal(14,2) NULL,
  `amount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `withdrawAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `reconsumptionAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `taxAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `note` varchar(500) NULL,
  `paidBy` varchar(255) NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_salary_payments_userId` (`userId`),
  UNIQUE KEY `UQ_salary_payments_month_userId` (`month`, `userId`),
  CONSTRAINT `FK_salary_payments_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Upgrading a table created by an earlier version.
--
-- 1) First version only (it had a `rank` column, salary by C1+ rank):
--
-- ALTER TABLE `salary_payments`
--   DROP COLUMN `rank`,
--   ADD COLUMN `rewardSales` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000' AFTER `month`,
--   ADD COLUMN `tierMin` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000' AFTER `rewardSales`,
--   ADD COLUMN `tierMax` decimal(36,18) NULL AFTER `tierMin`;
--
-- 2) Every earlier version. A user could be paid several times for a month
--    before; the unique key cannot be added while such rows exist, so check
--    first and resolve any row this returns:
--
-- SELECT `month`, `userId`, COUNT(*) AS payments
--   FROM `salary_payments` GROUP BY `month`, `userId` HAVING COUNT(*) > 1;
--
-- Then (the old (month, userId) index is named IDX_salary_payments_month_userId
-- when created by this script; if the table came from `npm run db:init`, find
-- its name with SHOW INDEX FROM `salary_payments`):
--
-- ALTER TABLE `salary_payments`
--   ADD COLUMN `tierCode` varchar(10) NULL AFTER `tierMax`,
--   ADD COLUMN `rate` decimal(6,4) NULL AFTER `tierCode`,
--   ADD COLUMN `vndRate` decimal(14,2) NULL AFTER `rate`,
--   DROP INDEX `IDX_salary_payments_month_userId`,
--   ADD UNIQUE KEY `UQ_salary_payments_month_userId` (`month`, `userId`);
