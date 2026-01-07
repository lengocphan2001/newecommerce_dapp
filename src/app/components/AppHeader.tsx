"use client";

import React from "react";
import { useRouter } from "next/navigation";
import LanguageSelect from "@/app/components/LanguageSelect";
import HeaderActions from "@/app/components/HeaderActions";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";

export default function AppHeader({
  titleKey = "homeTitle",
  right,
  theme = "light",
  showActions = true,
  showMenu = false,
  showQRScanner = false,
  centerTitle = false,
}: {
  titleKey?: "homeTitle" | "appName" | "productsTitle" | "ordersTitle" | "profileTitle" | "navAffiliate" | "navShopping" | "navWallets" | "navAccount";
  right?: React.ReactNode;
  theme?: "light" | "dark";
  showActions?: boolean;
  showMenu?: boolean;
  showQRScanner?: boolean;
  centerTitle?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { totalItems } = useShoppingCart();

  const isDark = theme === "dark";

  return (
    <header className={`sticky top-0 z-50 ${isDark ? "bg-[#102216]/95 dark:bg-[#102216]/95 backdrop-blur-md border-b border-gray-200 dark:border-[#23482f]" : "bg-[#f6f8f6]/95 backdrop-blur-md border-b border-gray-200"}`}>
      <div className="flex items-center p-4 justify-between">
        <div className="flex items-center gap-3 flex-1">
          {showMenu && (
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-[#193322] transition-colors">
              <span className="material-symbols-outlined text-gray-700 dark:text-white">menu</span>
            </button>
          )}
          {!centerTitle && (
            <h1 className={`text-lg font-bold leading-tight tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              {t(titleKey)}
            </h1>
          )}
        </div>
        {centerTitle && (
          <h1 className={`text-lg font-bold leading-tight tracking-tight flex-1 text-center ${isDark ? "text-white" : "text-gray-900"}`}>
            {t(titleKey)}
          </h1>
        )}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {showQRScanner && (
            <button className="flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-[#193322] transition-colors">
              <span className="material-symbols-outlined text-gray-700 dark:text-white">qr_code_scanner</span>
            </button>
          )}
          {showActions && (
            <div className="relative">
              <button
                onClick={() => router.push("/home/cart")}
                className="flex items-center justify-center p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-gray-800 dark:text-white">shopping_cart</span>
              </button>
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#13ec5b] text-[10px] font-bold text-[#102216]">
                  {totalItems}
                </span>
              )}
            </div>
          )}
          {right || <LanguageSelect />}
        </div>
      </div>
    </header>
  );
}


