"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }).format(price);
  };

  const handleProductClick = (productId: string) => {
    router.push(`/home/products/${productId}`);
  };

  return (
    <div className="flex flex-col bg-zinc-50">
      {/* Header */}
      <AppHeader titleKey="homeTitle" />

      <main className="flex-1 pb-28">
        {/* Banner */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <h2 className="text-2xl font-bold">Khuyến mãi đặc biệt</h2>
              <p className="mt-2 text-sm opacity-90">
                Giảm giá lên đến 50% cho tất cả sản phẩm
              </p>
              <button className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-zinc-100">
                Mua ngay
              </button>
            </div>
            <div className="absolute right-0 top-0 h-full w-32 bg-white/10"></div>
          </div>
        </div>

        {/* Products */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-900">
              Sản phẩm
            </h3>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl bg-white shadow-sm animate-pulse"
                >
                  <div className="aspect-square bg-zinc-200"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-zinc-200 rounded w-3/4"></div>
                    <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-zinc-500">Chưa có sản phẩm nào</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product.id)}
                  className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-square bg-zinc-100 overflow-hidden">
                    {product.thumbnailUrl ? (
                      <img
                        src={product.thumbnailUrl}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl text-zinc-400">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="line-clamp-2 text-sm font-medium text-zinc-900">
                      {product.name}
                    </h4>
                    <p className="mt-2 text-base font-bold text-blue-600">
                      {formatPrice(product.price)} USDT
                    </p>
                    {product.stock > 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Còn {product.stock} sản phẩm
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-red-500">Hết hàng</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
