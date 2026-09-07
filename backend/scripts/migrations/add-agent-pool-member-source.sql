-- Agent pool membership is now kept in sync with the agent rank (C1..C9)
-- whenever an order is approved. The sync must never fight the admin, so each
-- membership row records who created it:
--   MANUAL — added by hand from the admin panel; the sync leaves it alone.
--   AUTO   — created by the sync; only these rows are activated/deactivated
--            automatically when the user's rank changes.
--
-- syncedRank stores the rank the sync last saw for that user, so the reason a
-- member is in (or out of) a pool can be audited.

ALTER TABLE `agent_pool_members`
  ADD COLUMN `source` VARCHAR(20) NOT NULL DEFAULT 'MANUAL' AFTER `isActive`,
  ADD COLUMN `syncedRank` VARCHAR(20) NULL AFTER `source`;

-- Every row that exists before this change was added by an admin by hand.
UPDATE `agent_pool_members` SET `source` = 'MANUAL' WHERE `source` IS NULL OR `source` = '';
