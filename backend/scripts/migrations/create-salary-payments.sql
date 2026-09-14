-- Monthly salary paid by an admin to users whose reward sales (weak binary
-- branch sales) for a month reached the salary tier the admin filtered on.
-- Salaries are paid from the 10th of the following month. Each row is one
-- payment, paid like an agent pool reward: `amount` is the gross salary, split
-- with the shared wallet distribution (default 70% withdraw wallet, 20%
-- reconsumption wallet, 10% tax credited nowhere). A user can be paid more
-- than once for the same month, so (userId, month) is not unique.

CREATE TABLE IF NOT EXISTS `salary_payments` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `month` varchar(7) NOT NULL,
  `rewardSales` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `tierMin` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `tierMax` decimal(36,18) NULL,
  `amount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `withdrawAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `reconsumptionAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `taxAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `note` varchar(500) NULL,
  `paidBy` varchar(255) NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_salary_payments_userId` (`userId`),
  KEY `IDX_salary_payments_month_userId` (`month`, `userId`),
  CONSTRAINT `FK_salary_payments_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- If the table was already created by the first version (with a `rank`
-- column, salary by C1+ rank), bring it to this shape instead:
--
-- ALTER TABLE `salary_payments`
--   DROP COLUMN `rank`,
--   ADD COLUMN `rewardSales` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000' AFTER `month`,
--   ADD COLUMN `tierMin` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000' AFTER `rewardSales`,
--   ADD COLUMN `tierMax` decimal(36,18) NULL AFTER `tierMin`;
