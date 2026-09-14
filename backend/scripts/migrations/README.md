# Database migrations

When deploying to production, TypeORM `synchronize` is usually disabled, so new tables are not created automatically. Run the SQL scripts below on your MySQL database when you see `ER_NO_SUCH_TABLE` errors.

## Create `system_config` table

If you see:
```text
Table 'ecommerce_dapp.system_config' doesn't exist
```

**On the VPS (MySQL):**
```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/create-system-config-table.sql
```

Or connect to MySQL and run the contents of `create-system-config-table.sql` manually.

Replace `YOUR_DB_USER` and `YOUR_DB_NAME` with your actual MySQL user and database name (e.g. `ecommerce_dapp`).

## Add `usdtWithdrawPriceVnd` on `banking_config`

Withdraw-wallet VND estimate uses a **separate** rate from deposit/checkout (`usdtPriceVnd`). If `synchronize` is off and the column is missing:

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/add-usdt-withdraw-price-vnd.sql
```

## Add `rate` and `amountVnd` on `wallet_withdraw_requests`

Withdraw requests VND value is stored statically to prevent display balances from shifting when USDT withdrawal rate is changed in admin settings. If `synchronize` is off and the columns are missing:

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/add-withdraw-request-rate-and-amount-vnd.sql
```

## Add indexes on `orders` (`status`, `createdAt`)

Monthly reward calculation filters orders by status and a `createdAt` range, and the
admin dashboard sorts by `createdAt`. Without these indexes both scan the whole table.

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/add-orders-status-created-at-index.sql
```

MySQL has no `CREATE INDEX IF NOT EXISTS`, so run `SHOW INDEX FROM orders;` first and
skip any statement whose index is already present.

## Add wallet-split columns on `agent_pool_histories`

Agent pool rewards used to go entirely into the withdraw wallet. They are now split
70% withdraw wallet / 20% reconsumption wallet / 10% tax (percentages come from
`system_config`), and each payout row records the split. Existing rows are backfilled
as 100% withdraw so old history stays truthful.

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/add-agent-pool-wallet-split.sql
```

## Add `source` and `syncedRank` on `agent_pool_members`

Approving an order now syncs pool membership with the buyer's (and their upline's)
agent rank: a user ranked C5 is an active member of pools C1..C5, and drops out again
when the rank falls. Rows the admin added by hand are marked `MANUAL` and are never
touched by that sync.

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/add-agent-pool-member-source.sql
```

Rows the sync creates are marked `AUTO`.

## Add `agentRank` on `users`

The membership sync needs each user's current rank on the row, so approving an order can
recompute only the buyer and their upline (one query per level) instead of re-ranking the
whole tree.

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/add-user-agent-rank.sql
```

After running both migrations, call `POST /admin/agent-pool/members/sync-all` once: it fills
`users.agentRank` for everybody and enrols users who already qualified before the feature
existed. Until it runs, an F1 with an empty `agentRank` is counted at its base rank only.

## Create `salary_payments` table

Users are paid a monthly salary from the "Lương tháng" admin page when their reward
sales ("doanh số tính thưởng", the weak binary branch sales) for the month fall in the salary
tier the admin filters on (from X inclusive to Y exclusive; each tier can get a different
salary). The salary for a month can be paid from the 10th of the following month.
Each payment is paid like an agent pool reward: it is split with the same wallet
distribution from `system_config` (default 70% `users.withdrawWalletBalance`, 20%
`users.reconsumptionWalletBalance`, 10% tax credited nowhere). It is recorded
as one `salary_payments` row, which the user sees in the wallet's recent activity and on
`/home/wallets/activity`.

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < backend/scripts/migrations/create-salary-payments.sql
```

If `salary_payments` was already created by the first version (it had a `rank` column),
run the commented `ALTER TABLE` at the end of `create-salary-payments.sql`, or `npm run db:init`.
