"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { api } from "@/app/services/api";

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  thumbnailUrl?: string;
  stock: number;
}

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useI18n();
  const { addItem } = useShoppingCart();
  const router = useRouter();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.getProducts();
      setProducts(Array.isArray(response) ? response : response.data || []);
    } catch (err: any) {
      setError(err.message || t("failedToLoadProducts"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(t("productOutOfStock"));
      return;
    }
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      thumbnailUrl: product.thumbnailUrl,
    });
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="productsTitle" />
      <div className="mx-auto max-w-2xl px-4 pb-3">
        <div className="relative">
          <input
            type="text"
            placeholder={t("searchProductsPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 pl-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <main className="flex-1 pb-28">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-500">{t("loading")}</div>
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-500">{error}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500">
            {t("noProducts")}
          </div>
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => router.push(`/home/products/${product.id}`)}
                >
                  <div className="relative aspect-square bg-zinc-100">
                    {product.thumbnailUrl ? (
                      <img
                        src={product.thumbnailUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">
                        📦
                      </div>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded bg-red-500 px-3 py-1 text-sm font-semibold text-white">
                          {t("outOfStock")}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="line-clamp-2 text-sm font-medium text-zinc-900">
                      {product.name}
                    </h4>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-base font-bold text-blue-600">
                        ${product.price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={product.stock <= 0}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
                      >
                        {t("add")}
                      </button>
                    </div>
                    {product.stock > 0 && (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("stockAvailable").replace("{count}", product.stock.toString())}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
