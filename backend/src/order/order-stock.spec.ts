import { BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';

/**
 * OrderService.create only up to the stock check: the product lookup is
 * in memory and anything past the check makes the test stop with a marker.
 */
function setup(products: Array<{ id: string; name: string; stock: number }>) {
  const service = Object.create(OrderService.prototype) as OrderService;
  Object.assign(service, {
    productRepository: {
      find: jest.fn(async () => products.map((p) => ({ price: 10, ...p }))),
    },
    // First call after the stock check passes; stop there.
    adminService: {
      assertWalletPaymentEnabled: jest.fn(async () => {
        throw new Error('PAST_STOCK_CHECK');
      }),
    },
  });
  return service;
}

const order = (items: Array<{ productId: string; quantity: unknown }>) =>
  ({ items, paymentMethod: 'deposit_wallet' }) as any;

describe('OrderService.create stock check', () => {
  it('refuses an out of stock product', async () => {
    const service = setup([{ id: 'p1', name: 'Trà', stock: 0 }]);

    await expect(service.create(order([{ productId: 'p1', quantity: 1 }]), 'u1')).rejects.toThrow(
      new BadRequestException('Sản phẩm "Trà" đã hết hàng.'),
    );
  });

  it('adds up lines of the same product before comparing with stock', async () => {
    const service = setup([{ id: 'p1', name: 'Trà', stock: 3 }]);

    await expect(
      service.create(
        order([
          { productId: 'p1', quantity: 2 },
          { productId: 'p1', quantity: 2 },
        ]),
        'u1',
      ),
    ).rejects.toThrow(new BadRequestException('Sản phẩm "Trà" chỉ còn 3 trong kho.'));
  });

  it('refuses a zero, negative or fractional quantity', async () => {
    const service = setup([{ id: 'p1', name: 'Trà', stock: 10 }]);

    for (const quantity of [0, -1, 1.5, 'abc']) {
      await expect(service.create(order([{ productId: 'p1', quantity }]), 'u1')).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('lets an order within stock through', async () => {
    const service = setup([{ id: 'p1', name: 'Trà', stock: 3 }]);

    await expect(
      service.create(order([{ productId: 'p1', quantity: 3 }]), 'u1'),
    ).rejects.toThrow('PAST_STOCK_CHECK');
  });
});
