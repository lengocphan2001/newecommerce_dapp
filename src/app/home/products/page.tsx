"use client";

import React, { useState } from "react";
import LanguageSelect from "@/app/components/LanguageSelect";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useI18n();

  const products = [
    {
      id: 1,
      name: "iPhone 15 Pro Max 256GB",
      price: "29.990.000",
      originalPrice: "34.990.000",
      image: "📱",
      rating: 4.8,
      sold: 1250,
    },
    {
      id: 2,
      name: "Áo thun nam cao cấp",
      price: "299.000",
      originalPrice: "499.000",
      image: "👕",
      rating: 4.5,
      sold: 3200,
    },
    {
      id: 3,
      name: "Máy lọc không khí Xiaomi",
      price: "3.990.000",
      originalPrice: "4.990.000",
      image: "🏠",
      rating: 4.7,
      sold: 856,
    },
    {
      id: 4,
      name: "Giày thể thao Nike",
      price: "1.990.000",
      originalPrice: "2.490.000",
      image: "👟",
      rating: 4.6,
      sold: 2100,
    },
    {
      id: 5,
      name: "Tai nghe AirPods Pro",
      price: "5.990.000",
      originalPrice: "6.990.000",
      image: "🎧",
      rating: 4.9,
      sold: 4500,
    },
    {
      id: 6,
      name: "Laptop MacBook Pro M3",
      price: "49.990.000",
      originalPrice: "54.990.000",
      image: "💻",
      rating: 4.8,
      sold: 320,
    },
    {
      id: 7,
      name: "Đồng hồ thông minh",
      price: "2.990.000",
      originalPrice: "3.990.000",
      image: "⌚",
      rating: 4.4,
      sold: 1800,
    },
    {
      id: 8,
      name: "Balo du lịch cao cấp",
      price: "899.000",
      originalPrice: "1.299.000",
      image: "🎒",
      rating: 4.5,
      sold: 950,
    },
  ];

  return (
    <div className="flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-zinc-900">{t("productsTitle")}</h1>
            <LanguageSelect variant="light" />
          </div>
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder={t("searchProductsPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 pl-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
      </header>

      <main className="flex-1">
        {/* Filter Bar */}
        <div className="mx-auto max-w-2xl border-b border-zinc-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white">
              Tất cả
            </button>
            <button className="whitespace-nowrap rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-700">
              Điện tử
            </button>
            <button className="whitespace-nowrap rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-700">
              Thời trang
            </button>
            <button className="whitespace-nowrap rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-700">
              Gia dụng
            </button>
            <button className="whitespace-nowrap rounded-full bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-700">
              Thể thao
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <div
                key={product.id}
                className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square bg-zinc-100 flex items-center justify-center text-4xl">
                  {product.image}
                  {product.originalPrice && (
                    <div className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white">
                      -{Math.round(
                        ((parseInt(product.originalPrice.replace(/\./g, "")) -
                          parseInt(product.price.replace(/\./g, ""))) /
                          parseInt(product.originalPrice.replace(/\./g, ""))) *
                          100
                      )}%
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="line-clamp-2 text-sm font-medium text-zinc-900">
                    {product.name}
                  </h4>
                  <div className="mt-1 flex items-center gap-1">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`h-3 w-3 ${
                            i < Math.floor(product.rating)
                              ? "text-yellow-400"
                              : "text-zinc-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500">
                      ({product.sold})
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-base font-bold text-blue-600">
                      {product.price} đ
                    </p>
                    {product.originalPrice && (
                      <p className="text-xs text-zinc-400 line-through">
                        {product.originalPrice} đ
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
