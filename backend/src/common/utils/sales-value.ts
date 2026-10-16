import { EntityManager } from 'typeorm';
import { Product } from '../../product/entities/product.entity';

type SalesOrderItem = {
  productId?: string | null;
  price?: number | string | null;
  quantity?: number | string | null;
};

function itemValue(item: SalesOrderItem): number {
  return (Number(item?.price) || 0) * (Number(item?.quantity) || 0);
}

/**
 * Ids of products flagged excludeFromSales: orders for them earn commission as
 * usual but never count towards personal, branch or group sales.
 */
export async function loadSalesExcludedProductIds(
  manager: EntityManager,
): Promise<Set<string>> {
  const rows = await manager.getRepository(Product).find({
    select: ['id'],
    where: { excludeFromSales: true },
  });
  return new Set(rows.map((p) => p.id));
}

/**
 * Sales value of an order: item price times quantity (shipping excluded),
 * skipping items whose product is excluded from sales.
 */
export function orderSalesValue(
  items: SalesOrderItem[] | null | undefined,
  excludedProductIds: Set<string>,
): number {
  if (!Array.isArray(items)) return 0;
  let sum = 0;
  for (const item of items) {
    if (item?.productId && excludedProductIds.has(item.productId)) continue;
    sum += itemValue(item);
  }
  return sum;
}

/** Value of the items in an order whose product is excluded from sales. */
export function excludedItemsValue(
  items: SalesOrderItem[] | null | undefined,
  excludedProductIds: Set<string>,
): number {
  if (!Array.isArray(items) || excludedProductIds.size === 0) return 0;
  let sum = 0;
  for (const item of items) {
    if (item?.productId && excludedProductIds.has(item.productId)) {
      sum += itemValue(item);
    }
  }
  return sum;
}
