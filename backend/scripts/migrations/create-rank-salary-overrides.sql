-- Admins can now edit a month's C1 / C2 rank salary list from the "Lương tháng"
-- admin page (tab "Lương cấp bậc C1/C2"):
--   - `add`: put a user on the list as C1 or C2 although the monthly closing
--     did not give them that rank (`rank` holds the rank they are paid as).
--   - `remove`: leave out an agent the closing made C1 / C2.
-- The C1 and C2 pools are shared among the list after these changes. A user has
-- at most one change per month.
--
-- Each rank salary payment now also records whether the agent was on the list
-- by the monthly closing (`auto`) or added by an admin (`manual`). Every payment
-- made before this change was `auto`.

CREATE TABLE IF NOT EXISTS `rank_salary_overrides` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `month` varchar(7) NOT NULL,
  `action` varchar(16) NOT NULL,
  `rank` varchar(16) NULL,
  `note` varchar(500) NULL,
  `createdBy` varchar(255) NULL,
  `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_rank_salary_overrides_userId` (`userId`),
  UNIQUE KEY `UQ_rank_salary_overrides_month_userId` (`month`, `userId`),
  CONSTRAINT `FK_rank_salary_overrides_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `rank_salary_payments`
  ADD COLUMN `source` varchar(16) NOT NULL DEFAULT 'auto' AFTER `rank`;
