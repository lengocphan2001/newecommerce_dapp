-- Monthly rank salary for C1 / C2 agents, paid from the "Lương tháng" admin page
-- (tab "Lương cấp bậc C1/C2"). Two pools are built from the month's reward sales
-- (weak binary branch sales):
--   - Pool C1: 4% of the combined reward sales of all C1 and C2 agents, shared
--     equally among them (a C2 agent also sits in the C1 pool).
--   - Pool C2: 2% of the combined reward sales of the C2 agents, shared equally
--     among the C2 agents.
-- Paid from the 10th of the following month, once per agent per month, with the
-- same wallet split as agent pool rewards (default 70% withdraw wallet, 20%
-- reconsumption wallet, 10% tax credited nowhere).

CREATE TABLE IF NOT EXISTS `rank_salary_payments` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `month` varchar(7) NOT NULL,
  `rank` varchar(16) NOT NULL,
  `rewardSales` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `c1PoolAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `c1MemberCount` int NOT NULL DEFAULT '0',
  `c2PoolAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `c2MemberCount` int NOT NULL DEFAULT '0',
  `c1Share` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `c2Share` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `amount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `withdrawAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `reconsumptionAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `taxAmount` decimal(36,18) NOT NULL DEFAULT '0.000000000000000000',
  `note` varchar(500) NULL,
  `paidBy` varchar(255) NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_rank_salary_payments_userId` (`userId`),
  UNIQUE KEY `UQ_rank_salary_payments_month_userId` (`month`, `userId`),
  CONSTRAINT `FK_rank_salary_payments_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
