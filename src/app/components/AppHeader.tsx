"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { api } from "@/app/services/api";

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
  /** When true, show search bar in header and hide title (title goes on page) */
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
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
  showSearch = false,
  searchPlaceholder,
  searchValue = "",
  onSearchChange,
}: AppHeaderProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { totalItems } = useShoppingCart();
  const [mounted, setMounted] = useState(false);
  const [needsReconsumption, setNeedsReconsumption] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkReconsumptionStatus();
  }, []);

  const checkReconsumptionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const status = await api.checkReconsumption();
      setNeedsReconsumption(status.needsReconsumption || false);
    } catch (error) {
      // Silently fail - user might not be logged in
      setNeedsReconsumption(false);
    }
  };

  const displayTitle = showSearch ? "" : (title || (titleKey ? t(titleKey) : ""));

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
        {/* Left: back button (if any) */}
        {showBack && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 transition-colors text-slate-700 shrink-0"
          >
            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
          </button>
        )}

        {/* Center: search bar (when showSearch) or title */}
        {showSearch ? (
          <div className="relative flex-1 min-w-0 flex items-center">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <span className="material-symbols-outlined text-gray-400 text-lg">search</span>
            </div>
            <input
              className="block w-full py-2.5 pl-10 pr-3 text-sm text-gray-900 border border-gray-200 rounded-xl bg-gray-50 focus:ring-primary focus:border-primary placeholder:text-gray-400 shadow-inner"
              placeholder={searchPlaceholder}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        ) : (
          <>
            {!centerTitle && displayTitle && (
              <h1 className="text-lg font-bold tracking-tight text-slate-900 truncate min-w-0 flex-1">
                {displayTitle}
              </h1>
            )}
            {centerTitle && displayTitle && (
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex-1 text-center px-4">
                {displayTitle}
              </h1>
            )}
          </>
        )}

        {/* Right: reconsumption, cart, custom right */}
        <div className="flex items-center gap-2 shrink-0">
          {mounted && needsReconsumption && (
            <div className="relative">
              <button
                onClick={() => router.push("/home/shopping")}
                className="flex items-center justify-center size-10 rounded-full hover:bg-orange-50 transition-colors bg-white border-2 border-orange-400 shadow-sm"
                title="Cần tái tiêu dùng để tiếp tục nhận hoa hồng"
              >
                <span className="material-symbols-outlined text-orange-500 text-xl animate-pulse">notifications_active</span>
              </button>
              <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-orange-500 ring-2 ring-white animate-ping"></span>
            </div>
          )}
          {showActions && (
            <div className="relative">
              <button
                onClick={() => router.push("/home/cart")}
                className="flex items-center justify-center size-10 rounded-full hover:bg-gray-100 transition-colors bg-white border border-gray-200 shadow-sm"
                data-cart-icon
              >
                <span className="material-symbols-outlined text-slate-700 text-xl">shopping_cart</span>
              </button>
              {mounted && totalItems > 0 && (
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


