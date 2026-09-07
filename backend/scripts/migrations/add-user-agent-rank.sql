-- Approving an order can only change the agent rank of the buyer and of their
-- upline, so the sync walks that one chain instead of re-ranking every user.
-- That is only possible if each user's current rank is stored, because a rank
-- is derived from the ranks of the direct F1s.
--
-- Values: C0, DAILY, C1..C9. NULL means "never synced yet" — run
-- POST /admin/agent-pool/members/sync-all once after this migration to fill it.

ALTER TABLE `users`
  ADD COLUMN `agentRank` VARCHAR(20) NULL AFTER `manualRank`;
