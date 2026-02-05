import { DataSource } from 'typeorm';
import { Commission } from '../src/affiliate/entities/commission.entity';
import { Order } from '../src/order/entities/order.entity';
import { User } from '../src/user/entities/user.entity';
import { Address } from '../src/user/entities/address.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Database configuration - matching your environment
// PLEASE CHECK .env FOR THE CORRECT CREDENTIALS IF THESE ARE NOT CORRECT
const dataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'password', // REPLACE WITH YOUR DB PASSWORD
    database: process.env.DB_NAME || 'ecommerce_dapp',
    entities: [Commission, Order, User, Address],
    synchronize: false, // Do not sync schema here
});

async function cleanup() {
    try {
        console.log('Connecting to database...');
        await dataSource.initialize();
        console.log('Connected!');

        console.log('Checking for orphaned commissions...');

        // Find commissions where orderId is not found in orders table
        // Using raw query for speed and simplicity in this cleanup context
        const orphanedCommissions = await dataSource.query(`
      SELECT id, orderId FROM commissions 
      WHERE orderId NOT IN (SELECT id FROM orders)
    `);

        if (orphanedCommissions.length > 0) {
            console.log(`Found ${orphanedCommissions.length} orphaned commissions.`);

            const idsToDelete = orphanedCommissions.map((c: any) => `'${c.id}'`).join(',');

            console.log('Deleting orphaned commissions...');
            await dataSource.query(`DELETE FROM commissions WHERE id IN (${idsToDelete})`);

            console.log('Successfully deleted orphaned commissions.');
        } else {
            console.log('No orphaned commissions found.');
        }

        console.log('Cleanup complete.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        if (dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

cleanup();
