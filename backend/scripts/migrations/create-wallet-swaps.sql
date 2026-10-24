-- MySQL version. See create-wallet-swaps.postgres.sql for PostgreSQL.
--
-- Users can move balance from the reward wallet (withdrawWalletBalance) to the
-- consumption wallet (reconsumptionWalletBalance) themselves, with no admin
-- approval. Each row is one swap; `rate` and `amountVnd` freeze the USDT/VND
-- withdraw rate at swap time so the history never shifts.

CREATE TABLE IF NOT EXISTS `wallet_swaps` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `amount` decimal(36,18) NOT NULL,
  `rate` decimal(14,2) NULL,
  `amountVnd` decimal(36,2) NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_wallet_swaps_userId` (`userId`),
  CONSTRAINT `FK_wallet_swaps_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
