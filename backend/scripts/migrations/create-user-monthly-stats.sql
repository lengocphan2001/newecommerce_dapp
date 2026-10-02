-- SQL Migration: Create user_monthly_stats table for Level 3 & Level 4 rewards

CREATE TABLE IF NOT EXISTS `user_monthly_stats` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `month` varchar(10) NOT NULL,
  `personalSales` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `groupSales` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `calculatedRank` varchar(255) NOT NULL DEFAULT 'C0',
  `groupRewardRate` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `groupRewardAmount` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `globalShareAmount` decimal(18,4) NOT NULL DEFAULT '0.0000',
  `isProcessed` tinyint NOT NULL DEFAULT '0',
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_USER_MONTH` (`userId`,`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
