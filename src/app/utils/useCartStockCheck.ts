"use client";

import { useEffect, useMemo } from "react";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { api } from "@/app/services/api";

/**
 * Loads the current stock of every product in the cart (never cached) and
 * stores it on the cart lines, so the cart can't go above it. Returns the
 * products whose cart quantity is more than their stock: productId → stock.
 * Lines whose stock is unknown (the request failed) are not flagged; the
 * backend still refuses an order it can't fill.
 */
export function useCartStockCheck(): Map<string, number> {
  const { items, syncStock } = useShoppingCart();
  const productIdsKey = [...new Set(items.map((i) => i.productId))].sort().join(",");

  useEffect(() => {
    if (!productIdsKey) return;
    let cancelled = false;
    api
      .getProductStocks(productIdsKey.split(","))
      .then((stockById) => !cancelled && syncStock(stockById))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [productIdsKey, syncStock]);

  return useMemo(() => {
    const qtyById = new Map<string, number>();
    const stockById = new Map<string, number>();
    for (const item of items) {
      qtyById.set(item.productId, (qtyById.get(item.productId) ?? 0) + item.quantity);
      if (typeof item.stock === "number") stockById.set(item.productId, item.stock);
    }
    const problems = new Map<string, number>();
    for (const [productId, stock] of stockById) {
      if ((qtyById.get(productId) ?? 0) > stock) problems.set(productId, stock);
    }
    return problems;
  }, [items]);
}
