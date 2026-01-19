/**
 * Script to initialize database tables
 * This script temporarily enables synchronize to create tables
 * 
 * Usage: 
 *   npm run db:init
 * 
 * Or directly:
 *   ts-node -r tsconfig-paths/register scripts/init-database.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../src/user/entities/user.entity';
import { Address } from '../src/user/entities/address.entity';
import { Product } from '../src/product/entities/product.entity';
import { Category } from '../src/category/entities/category.entity';
import { Slider } from '../src/slider/entities/slider.entity';
import { Order } from '../src/order/entities/order.entity';
import { Commission } from '../src/affiliate/entities/commission.entity';
import { AuditLog } from '../src/audit-log/entities/audit-log.entity';
import { CommissionConfig } from '../src/admin/entities/commission-config.entity';
import { MilestoneRewardConfig } from '../src/admin/entities/milestone-reward-config.entity';
import { UserMilestone } from '../src/admin/entities/user-milestone.entity';

// Load environment variables from .env file
dotenv.config();

async function initializeDatabase() {
  // Environment variables are loaded from .env file
  // Make sure .env file exists in backend directory

  const dbType = (process.env.DB_TYPE || 'postgres') as any;
  const isMySQL = dbType === 'mysql';
  
  const dbConfig = {
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || (isMySQL ? '3306' : '5432'), 10),
    username: process.env.DB_USERNAME || (isMySQL ? 'root' : 'postgres'),
    password: process.env.DB_PASSWORD || (isMySQL ? 'root' : 'postgres'),
    database: process.env.DB_NAME || 'ecommerce_dapp',
  };

  // Debug: Show connection info (without password)
  console.log('Database configuration:');
  console.log(`  Type: ${dbConfig.type}`);
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Username: ${dbConfig.username}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  Password: ${dbConfig.password ? '***' : 'NOT SET'}`);
  
  const dataSource = new DataSource({
    ...dbConfig,
    entities: [User, Address, Category, Slider, Product, Order, Commission, AuditLog, CommissionConfig, MilestoneRewardConfig, UserMilestone],
    synchronize: true, // Enable synchronize to create tables
    logging: true,
  });

  try {
    console.log('\nConnecting to database...');
    await dataSource.initialize();
    console.log('Database connected successfully!');
    
    console.log('Synchronizing database schema...');
    await dataSource.synchronize();
    console.log('Database tables created successfully!');
    
    await dataSource.destroy();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

initializeDatabase();
