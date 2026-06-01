import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';

async function clearHeapRewards() {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    process.env[key] = value;
                }
            });
        }

        console.log(`Connecting to database: ${process.env.DB_NAME} at ${process.env.DB_HOST}...`);

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USERNAME || 'root',
            password: process.env.DB_PASSWORD || 'password',
            database: process.env.DB_NAME || 'ecommerce_dapp',
            multipleStatements: true
        });

        console.log('Connected. Clearing heap reward data...');

        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        const tables = [
            'heap_reward_placements',
            'heap_reward_histories',
            'promising_product_placements',
            'promising_product_histories'
        ];

        for (const table of tables) {
            try {
                await connection.query(`TRUNCATE TABLE ${table};`);
                console.log(`✅ Truncated ${table}`);
            } catch (err: any) {
                if (err.code === 'ER_NO_SUCH_TABLE') {
                    console.log(`⚠️ Table ${table} does not exist, skipping.`);
                } else {
                    throw err;
                }
            }
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('🎉 Heap reward data cleared successfully.');

        await connection.end();
    } catch (error) {
        console.error('❌ Error clearing heap reward data:', error);
        process.exit(1);
    }
}

clearHeapRewards();
