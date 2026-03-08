-- Run this on your MySQL database (e.g. ecommerce_dapp) when you get:
-- ER_NO_SUCH_TABLE: Table 'ecommerce_dapp.system_config' doesn't exist
--
-- Usage: mysql -u YOUR_USER -p YOUR_DATABASE < create-system-config-table.sql

CREATE TABLE IF NOT EXISTS `system_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text NOT NULL,
  `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_system_config_key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: insert default min payout threshold (50) so admin can change it later
INSERT IGNORE INTO `system_config` (`key`, `value`, `updatedAt`) VALUES ('minPayoutThreshold', '50', NOW(6));
