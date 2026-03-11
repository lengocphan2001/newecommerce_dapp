/**
 * One-time script: set all products to useProductCommission = false (hoa hồng gói / package).
 * Run from backend folder: npm run script:set-product-package
 * Or: npx ts-node -r tsconfig-paths/register scripts/set-all-products-use-package-commission.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Product } from '../src/product/entities/product.entity';
import { Category } from '../src/category/entities/category.entity';

// Load .env from backend folder (run with: npm run script:set-product-package from backend)
dotenv.config();

async function run() {
  const dbType = (process.env.DB_TYPE || 'postgres') as 'mysql' | 'postgres';
  const isMySQL = dbType === 'mysql';

  const dataSource = new DataSource({
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: [Product, Category],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    const result = await dataSource
      .createQueryBuilder()
      .update(Product)
      .set({ useProductCommission: false })
      .execute();
    const count = result.affected ?? 0;
    console.log(`Done. Updated ${count} product(s) to useProductCommission = false (hoa hồng gói).`);
    await dataSource.destroy();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
