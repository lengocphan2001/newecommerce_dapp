import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { WalletService } from '../../src/wallet/wallet.service';

async function run() {
  console.log('Bootstrapping NestJS...');
  process.env.NODE_ENV = 'development';

  const app = await NestFactory.createApplicationContext(AppModule);
  const walletService = app.get(WalletService);

  const logs = [
    {
      txHash: '0x76119419f5ccb5ef0c4b8898036afb6bcfd35aaa712f82cca9ba5f11789b8179',
      from: '0x50223f86FD2187972871B036F541383Dce8b4D74',
      to: '0x65c03707C17EA9F7Dc1C1Eb2c0C12D3AfC3e7fe1',
      value: '0x0000000000000000000000000000000000000000000000001bc16d674ec80000', // 2 USDT
      blockNumber: 99475233
    }
  ];

  console.log('Chạy processWebhookLogs với logs giao dịch thật...');
  try {
    // Thêm kiểm tra trực tiếp trước khi chạy
    const connection = require('mysql2/promise');
    const conn = await connection.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'ecommerce_dapp',
      port: 3306
    });
    const [rows] = await conn.execute('SELECT * FROM wallet_deposit_requests WHERE status = "PENDING"');
    console.log('--- DEBUG DATABASE PENDING DEPOSITS ---');
    console.log(rows);
    await conn.end();

    const result = await walletService.processWebhookLogs(logs);
    console.log('KẾT QUẢ XỬ LÝ:', JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error('Lỗi khi chạy xử lý:', e);
  } finally {
    await app.close();
  }
}

run();
