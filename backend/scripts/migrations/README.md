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
