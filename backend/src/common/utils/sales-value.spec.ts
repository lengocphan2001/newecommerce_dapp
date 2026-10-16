import { excludedItemsValue, orderSalesValue } from './sales-value';

describe('sales-value', () => {
  const items = [
    { productId: 'a', price: 100, quantity: 2 },
    { productId: 'b', price: 50, quantity: 1 },
    { productId: 'c', price: '30', quantity: '3' },
  ];

  it('counts every item when no product is excluded', () => {
    expect(orderSalesValue(items, new Set())).toBe(340);
    expect(excludedItemsValue(items, new Set())).toBe(0);
  });

  it('skips items of excluded products', () => {
    const excluded = new Set(['b']);
    expect(orderSalesValue(items, excluded)).toBe(290);
    expect(excludedItemsValue(items, excluded)).toBe(50);
  });

  it('gives zero sales when every product is excluded', () => {
    const excluded = new Set(['a', 'b', 'c']);
    expect(orderSalesValue(items, excluded)).toBe(0);
    expect(excludedItemsValue(items, excluded)).toBe(340);
  });

  it('handles missing items', () => {
    expect(orderSalesValue(null, new Set(['a']))).toBe(0);
    expect(excludedItemsValue(undefined, new Set(['a']))).toBe(0);
  });
});
