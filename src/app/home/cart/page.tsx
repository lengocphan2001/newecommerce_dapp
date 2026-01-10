"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { useI18n } from "@/app/i18n/I18nProvider";
import { api } from "@/app/services/api";

export default function CartPage() {
  const { items, updateQuantity, removeItem, totalAmount, totalItems, clearCart } = useShoppingCart();
  const router = useRouter();
  const { t } = useI18n();
  const [referralInfo, setReferralInfo] = useState<{ packageType?: 'NONE' | 'CTV' | 'NPP' } | null>(null);
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    // Fetch referral info to get package type for discount
    api.getReferralInfo().then(setReferralInfo).catch(() => {
      // User might not be logged in
    });
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(price);
  };

  const formatVND = (usdt: number) => {
    // Approximate conversion: 1 USDT = 25,000 VNĐ
    return Math.round(usdt * 25000).toLocaleString("vi-VN");
  };

  const getRankName = (packageType?: string) => {
    if (packageType === 'NPP') return 'NPP';
    if (packageType === 'CTV') return 'CTV';
    return 'NONE';
  };

  // Final total
  const finalTotal = totalAmount;

  if (items.length === 0) {
    return (
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-xl bg-white">
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center p-4 pb-3 justify-between">
            <button 
              onClick={() => router.back()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-slate-800"
            >
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-2 text-slate-900">
              {t("navShopping")}
            </h2>
            <div className="w-10"></div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-44 bg-gray-50/50">
          <div className="mx-auto max-w-2xl px-4 py-12 text-center">
            <div className="mb-4 text-6xl">🛒</div>
            <h2 className="mb-2 text-xl font-semibold text-slate-900">
              {t("cartEmpty")}
            </h2>
            <p className="mb-6 text-slate-500">
              {t("cartEmptyMessage")}
            </p>
            <button
              onClick={() => router.push("/home")}
              className="rounded-lg bg-primary px-6 py-3 font-medium text-black transition hover:bg-primary-dark"
            >
              {t("shopNow")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-xl bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center p-4 pb-3 justify-between">
          <button 
            onClick={() => router.back()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-slate-800"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-2 text-slate-900">
              {t("cartTitle")} ({totalItems})
            </h2>
            <div className="flex items-center justify-end">
            <button 
              onClick={clearCart}
              className="text-red-500 text-sm font-bold leading-normal tracking-[0.015em] shrink-0 hover:bg-red-50 px-2 py-1 rounded transition-colors"
            >
              {t("clearAll")}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-44 no-scrollbar bg-gray-50/50">
        {/* Reward Banner */}
        {referralInfo?.packageType && referralInfo.packageType !== 'NONE' && (
          <div className="px-4 pt-4">
            <div className="bg-white rounded-xl border border-primary/30 p-4 shadow-card relative overflow-hidden group">
              <div className="absolute right-[-20px] top-[-20px] size-24 bg-primary/20 rounded-full blur-2xl"></div>
              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎉</span>
                    <p className="text-slate-800 font-bold text-base leading-tight">{t("cashback2Percent")}</p>
                  </div>
                  <p className="text-slate-500 text-xs font-medium leading-normal">
                    {t("affiliateLevel")} <span className="text-yellow-600 font-bold">{getRankName(referralInfo.packageType)}</span>
                  </p>
                </div>
                <a 
                  onClick={() => router.push("/home/affiliate")}
                  className="inline-flex items-center gap-1 text-sm font-bold text-primary-content hover:text-primary transition-colors cursor-pointer"
                >
                  {t("details")}
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex flex-col gap-4 p-4">
          {items.map((item) => (
            <div key={item.productId} className="flex flex-col gap-3 bg-white rounded-xl p-3 shadow-card border border-gray-100">
              <div className="flex gap-4">
                <div className="relative shrink-0">
                  {item.thumbnailUrl ? (
                    <div 
                      className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px]"
                      style={{ backgroundImage: `url("${item.thumbnailUrl}")` }}
                    ></div>
                  ) : (
                    <div className="flex items-center justify-center rounded-lg size-[80px] bg-gray-100 text-2xl">
                      📦
                    </div>
                  )}
                  <div className="absolute -top-1 -left-1 bg-primary text-black rounded-full p-0.5 shadow-sm ring-2 ring-white">
                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight line-clamp-2">{item.productName}</h3>
                      <p className="text-slate-500 text-xs mt-1 font-medium">{t("unit")}</p>
                    </div>
                    <button 
                      onClick={() => removeItem(item.productId)}
                      className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div className="flex flex-col">
                      <span className="text-emerald-700 font-extrabold text-lg">{formatPrice(item.price)} USDT</span>
                      <span className="text-[11px] text-slate-500 font-medium">~{formatVND(item.price)} VNĐ</span>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="size-7 flex items-center justify-center rounded bg-white shadow-sm hover:bg-gray-100 transition-colors text-slate-600 border border-gray-100"
                      >
                        <span className="material-symbols-outlined text-sm">remove</span>
                      </button>
                      <input 
                        className="w-8 text-center bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:ring-0" 
                        readOnly 
                        type="text" 
                        value={item.quantity}
                      />
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="size-7 flex items-center justify-center rounded bg-primary text-black shadow-sm hover:bg-primary/80 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>


        {/* Price Summary */}
        <div className="px-4 py-4 bg-white border-t border-gray-100">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{t("subtotal")}</span>
            <span className="font-semibold text-slate-900">{formatPrice(totalAmount)} USDT</span>
          </div>
        </div>
      </main>

      {/* Footer - Checkout Button */}
      <footer className="fixed bottom-0 w-full max-w-md bg-white backdrop-blur-xl border-t border-gray-100 pt-4 px-4 z-[60] shadow-float" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px) + 80px)' }}>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end">
              <div className="flex flex-col">
                <span className="text-xs text-slate-500 font-medium mb-1">{t("totalPayment")}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 tracking-tight">{formatPrice(finalTotal)}</span>
                  <span className="text-base font-bold text-emerald-600">USDT</span>
                </div>
              </div>
            </div>
          <button 
            onClick={() => router.push("/home/checkout")}
            className="group w-full bg-primary hover:bg-[#0fd650] active:scale-[0.98] transition-all duration-200 text-black font-extrabold text-lg py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(19,236,91,0.25)] hover:shadow-[0_12px_24px_rgba(19,236,91,0.35)]"
          >
            {t("proceedToPayment")}
            <span className="material-symbols-outlined text-black font-bold group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
          <p className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] filled text-emerald-500">verified_user</span>
            {t("securePayment")}
          </p>
        </div>
      </footer>
    </div>
  );
}
