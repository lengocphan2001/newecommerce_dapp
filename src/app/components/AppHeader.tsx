"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";

interface AppHeaderProps {
  titleKey?: "homeTitle" | "appName" | "productsTitle" | "ordersTitle" | "profileTitle" | "navAffiliate" | "navShopping" | "navWallets" | "navAccount" | "activityHistory";
  title?: string;
  right?: React.ReactNode;
  showBack?: boolean;
  showActions?: boolean;
  showMenu?: boolean;
  showQRScanner?: boolean;
  centerTitle?: boolean;
  onBack?: () => void;
}

export default function AppHeader({
  titleKey,
  title,
  right,
  showBack = false,
  showActions = true,
  showMenu = false,
  showQRScanner = false,
  centerTitle = false,
  onBack,
}: AppHeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { totalItems } = useShoppingCart();

  const displayTitle = title || (titleKey ? t(titleKey) : "");

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
        {/* Left Section */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBack && (
            <button 
              onClick={handleBack}
              className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 transition-colors text-slate-700 shrink-0"
            >
              <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
            </button>
          )}
          {!centerTitle && displayTitle && (
            <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate">
              {displayTitle}
            </h1>
          )}
        </div>

        {/* Center Title */}
        {centerTitle && displayTitle && (
          <h1 className="text-lg font-bold tracking-tight text-slate-900 flex-1 text-center px-4">
            {displayTitle}
          </h1>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-2 shrink-0">
          {showActions && (
            <div className="relative">
              <button
                onClick={() => router.push("/home/cart")}
                className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 transition-colors bg-white border border-gray-200 shadow-sm"
              >
                <span className="material-symbols-outlined text-slate-700 text-xl">shopping_cart</span>
              </button>
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white ring-2 ring-white">
                  {totalItems}
                </span>
              )}
            </div>
          )}
          {right}
        </div>
      </div>
    </header>
  );
}


