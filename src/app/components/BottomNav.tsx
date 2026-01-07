"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const menuItems = [
    {
      href: "/home",
      label: t("navHome"),
      icon: "storefront",
    },
    {
      href: "/home/wallets",
      label: t("navWallets"),
      icon: "account_balance_wallet",
    },
    {
      href: "/home/affiliate",
      label: "Team",
      icon: "group",
    },
    {
      href: "/home/account",
      label: t("navAccount"),
      icon: "person",
    },
  ];

  const handleNavigate = (href: string) => {
    // Prevent navigation if already on that page
    if (pathname === href) return;
    
    // Use Next.js router to preserve state and avoid full page reload
    router.push(href);
  };

  const { totalItems } = useShoppingCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 dark:border-[#23482f] bg-[#f6f8f6]/95 dark:bg-[#102216]/95 backdrop-blur-md pb-safe">
      <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
        {menuItems.map((item, index) => {
          // Shopping should be active for /home/shopping, /home/cart, and /home/checkout
          let isActive = pathname === item.href || (item.href === "/home" && pathname === "/home");
          if (item.href === "/home/shopping") {
            isActive = pathname === "/home/shopping" || pathname === "/home/cart" || pathname === "/home/checkout";
          }
          
          // QR Scanner button ở giữa (index 1 - wallet)
          if (index === 1) {
            return (
              <div key={item.href} className="relative -top-6">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleNavigate(item.href);
                  }}
                  className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg shadow-[#13ec5b]/30 transform transition-transform hover:scale-105 active:scale-95 ${
                    isActive
                      ? "bg-[#13ec5b] text-[#102216]"
                      : "bg-[#193322] text-white border border-[#23482f]"
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[28px]">qr_code_scanner</span>
                </button>
              </div>
            );
          }
          
          return (
            <button
              key={item.href}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNavigate(item.href);
              }}
              className={`flex flex-col items-center gap-1 p-2 transition-colors ${
                isActive
                  ? "text-[#13ec5b] dark:text-[#13ec5b]"
                  : "text-gray-400 dark:text-gray-500 hover:text-[#13ec5b] dark:hover:text-[#13ec5b]"
              }`}
              type="button"
            >
              <span className={`material-symbols-outlined ${isActive ? "fill-1" : ""}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
