-- PostgreSQL version. See add-order-wallet-payer.sql for MySQL.
--
-- Orders paid from an internal wallet now record who paid (the sponsor on
-- proxy orders, not the buyer) and, for the consumption wallet, how much came
-- from the commission part (reconsumptionWalletBalance). Deleting an order uses
-- them to refund the money to the wallet it came from.
--
-- Older orders keep NULL: the refund then finds the payer from the
-- "Mua hộ bởi @username" note, and puts consumption wallet payments back into
-- reconsumptionWalletBalance.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "paidByUserId" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS "paidFromReconsumptionAmount" DECIMAL(36,18) NULL;
