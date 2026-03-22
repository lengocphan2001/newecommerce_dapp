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
