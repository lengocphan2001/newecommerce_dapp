import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { HeapRewardService } from '../../src/heap-reward/heap-reward.service';
import { DataSource } from 'typeorm';
import { User } from '../../src/user/entities/user.entity';
import { Product } from '../../src/product/entities/product.entity';
import { Order, OrderStatus } from '../../src/order/entities/order.entity';
import { HeapRewardPlacement } from '../../src/heap-reward/entities/heap-reward-placement.entity';
import { SystemConfig } from '../../src/admin/entities/system-config.entity';

async function run() {
  console.log('Khởi tạo context NestJS...');
  process.env.NODE_ENV = 'development';

  const app = await NestFactory.createApplicationContext(AppModule);
  const heapService = app.get(HeapRewardService);
  const dataSource = app.get(DataSource);

  const userRepo = dataSource.getRepository(User);
  const productRepo = dataSource.getRepository(Product);
  const orderRepo = dataSource.getRepository(Order);
  const heapPlacementRepo = dataSource.getRepository(HeapRewardPlacement);
  const configRepo = dataSource.getRepository(SystemConfig);

  try {
    console.log('--- DỌN DẸP DỮ LIỆU CŨ ĐỂ KHỞI TẠO TEST ---');
    await heapPlacementRepo.createQueryBuilder().delete().execute();
    
    // Xóa và tạo lại cấu hình mặc định để đồng bộ
    await configRepo.delete({ key: 'HEAP_POOL_PERCENT_100' });
    await configRepo.delete({ key: 'HEAP_POOL_PERCENT_500' });
    await configRepo.delete({ key: 'HEAP_POOL_PERCENT_2400' });

    await configRepo.save([
      { key: 'HEAP_POOL_PERCENT_100', value: '5' },
      { key: 'HEAP_POOL_PERCENT_500', value: '10' },
      { key: 'HEAP_POOL_PERCENT_2400', value: '10' },
    ]);

    // Tạo sản phẩm test
    console.log('Tạo sản phẩm test...');
    let testProduct = await productRepo.findOne({ where: { name: 'Sản Phẩm Test' } });
    if (!testProduct) {
      testProduct = productRepo.create({
        name: 'Sản Phẩm Test',
        price: 1,
        stock: 9999,
      });
      await productRepo.save(testProduct);
    }

    // Tạo 12 user test
    console.log('Tạo 12 user test...');
    const users: User[] = [];
    for (let i = 1; i <= 12; i++) {
      const username = `test_user_pool_${i}`;
      let u = await userRepo.findOne({ where: { username } });
      if (!u) {
        u = userRepo.create({
          username,
          email: `${username}@gmail.com`,
          fullName: `User Test Pool ${i}`,
          password: 'password123',
          withdrawWalletBalance: 0,
          walletBalance: 0,
          pvWalletBalance: 0,
        });
        await userRepo.save(u);
      } else {
        u.withdrawWalletBalance = 0;
        await userRepo.save(u);
      }
      users.push(u);
    }

    console.log('--- TEST CASE 1: ĐƠN HÀNG NHỎ 100 PV ---');
    // Đơn hàng của user 1 trị giá 100 PV
    let order1 = orderRepo.create({
      userId: users[0].id,
      items: [{ productId: testProduct.id, productName: testProduct.name, quantity: 100, price: 1 }],
      totalAmount: 100,
      status: OrderStatus.CONFIRMED,
    });
    order1 = await orderRepo.save(order1);
    await heapService.processOrderIfEligible(order1.id);

    // Kiểm tra vị trí của user 1 trong cây đồng chia 100 PV
    const placementsU1 = await heapPlacementRepo.find({ where: { userId: users[0].id } });
    console.log(`User 1 Heap Placements:`, placementsU1.map(p => `Bể ${p.poolLevel} - Active: ${p.isActive}`));

    console.log('--- TEST CASE 2: ĐƠN HÀNG 2400 PV (NHẢY CÂY 100, 500, 2400) ---');
    for (let i = 0; i < 12; i++) {
      const user = users[i];
      let order = orderRepo.create({
        userId: user.id,
        items: [{ productId: testProduct.id, productName: testProduct.name, quantity: 2400, price: 1 }],
        totalAmount: 2400,
        status: OrderStatus.CONFIRMED,
      });
      order = await orderRepo.save(order);
      await heapService.processOrderIfEligible(order.id);
      console.log(`Đã xử lý xong đơn hàng 2400 PV cho User ${i + 1}`);
    }

  } catch (e: any) {
    console.error('Lỗi mô phỏng:', e);
  } finally {
    await app.close();
  }
}

run();
