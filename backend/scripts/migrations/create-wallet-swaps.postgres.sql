-- PostgreSQL version. See create-wallet-swaps.sql for MySQL.
--
-- Users can move balance from the reward wallet (withdrawWalletBalance) to the
-- consumption wallet (reconsumptionWalletBalance) themselves, with no admin
-- approval. Each row is one swap; "rate" and "amountVnd" freeze the USDT/VND
-- withdraw rate at swap time so the history never shifts.

CREATE TABLE IF NOT EXISTS "wallet_swaps" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL,
  "amount" DECIMAL(36,18) NOT NULL,
  "rate" DECIMAL(14,2) NULL,
  "amountVnd" DECIMAL(36,2) NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_wallet_swaps" PRIMARY KEY ("id"),
  CONSTRAINT "FK_wallet_swaps_user" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_wallet_swaps_userId" ON "wallet_swaps" ("userId");
