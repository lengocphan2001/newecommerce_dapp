-- Monthly salary paid by an admin to agents (C1..C9) of a closed sales month.
-- Salaries are paid from the 10th of the following month. Each row is one
-- payment, paid like an agent pool reward: `amount` is the gross salary, split
-- with the shared wallet distribution (default 70% withdraw wallet, 20%
-- reconsumption wallet, 10% tax credited nowhere). A user can be paid more than once for the
-- same month, so (userId, month) is not unique.

CREATE TABLE IF NOT EXISTS `salary_payments` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `month` varchar(7) NOT NULL,
  `rank` varchar(16) NOT NULL,
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
