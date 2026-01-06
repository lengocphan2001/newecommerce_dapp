"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalAmount, totalItems } = useShoppingCart();
  const router = useRouter();
  const { t } = useI18n();

  if (items.length === 0) {
    return (
      <div className="flex flex-col bg-zinc-50">
        <AppHeader titleKey="navShopping" />
        <main className="flex-1 pb-28">
          <div className="mx-auto max-w-2xl px-4 py-12 text-center">
            <div className="mb-4 text-6xl">🛒</div>
            <h2 className="mb-2 text-xl font-semibold text-zinc-900">
              {t("cartEmpty")}
            </h2>
            <p className="mb-6 text-zinc-500">
              {t("cartEmptyMessage")}
            </p>
            <button
              onClick={() => router.push("/home/products")}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
            >
              {t("shopNow")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navShopping" />
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="mb-4 space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.productName}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-zinc-100 text-2xl">
                    📦
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-medium text-zinc-900">{item.productName}</h4>
                  <p className="text-sm font-semibold text-blue-600">
                    ${item.price.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="ml-2 text-red-500 transition hover:text-red-700"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="sticky bottom-20 rounded-xl bg-white p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-200 pb-4">
              <span className="text-sm font-medium text-zinc-800">{t("total")} ({totalItems} {t("items")}):</span>
              <span className="text-xl font-bold text-blue-600">
                ${totalAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>
            <button
              onClick={() => router.push("/home/checkout")}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700"
            >
              {t("checkout")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
