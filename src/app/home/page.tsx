"use client";

import React from "react";
import AppHeader from "@/app/components/AppHeader";

export default function HomePage() {
  const categories = [
    { id: 1, name: "Điện tử", icon: "📱", color: "bg-blue-100" },
    { id: 2, name: "Thời trang", icon: "👕", color: "bg-pink-100" },
    { id: 3, name: "Đồ gia dụng", icon: "🏠", color: "bg-green-100" },
    { id: 4, name: "Thể thao", icon: "⚽", color: "bg-orange-100" },
  ];

  const featuredProducts = [
    {
      id: 1,
      name: "iPhone 15 Pro Max",
      price: "29.990.000",
      image: "📱",
      rating: 4.8,
    },
    {
      id: 2,
      name: "Áo thun nam cao cấp",
      price: "299.000",
      image: "👕",
      rating: 4.5,
    },
    {
      id: 3,
      name: "Máy lọc không khí",
      price: "3.990.000",
      image: "🏠",
      rating: 4.7,
    },
    {
      id: 4,
      name: "Giày thể thao",
      price: "1.990.000",
      image: "👟",
      rating: 4.6,
    },
  ];

  return (
    <div className="flex flex-col bg-zinc-50">
      {/* Header */}
      <AppHeader
        titleKey="homeTitle"
        right={
          <>
            <button className="relative">
              <svg
                className="h-6 w-6 text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                3
              </span>
            </button>
            <button>
              <svg
                className="h-6 w-6 text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </button>
          </>
        }
      />

      <main className="flex-1">
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

        {/* Categories */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h3 className="mb-3 text-lg font-semibold text-zinc-900">
            Danh mục
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {categories.map((category) => (
              <button
                key={category.id}
                className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm transition-transform hover:scale-105"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${category.color}`}
                >
                  {category.icon}
                </div>
                <span className="text-xs font-medium text-zinc-700">
                  {category.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Products */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-900">
              Sản phẩm nổi bật
            </h3>
            <button className="text-sm font-medium text-blue-600">
              Xem tất cả
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="group cursor-pointer overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square bg-zinc-100 flex items-center justify-center text-4xl">
                  {product.image}
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
                      {product.rating}
                    </span>
                  </div>
                  <p className="mt-2 text-base font-bold text-blue-600">
                    {product.price} đ
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
