"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { totalItems } = useShoppingCart();
  const [mounted, setMounted] = useState(false);

  // Fix hydration mismatch by only showing badge after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug: Log pathname changes
  useEffect(() => {
    if (mounted) {
      
    }
  }, [pathname, mounted]);

  const menuItems = [
    {
      href: "/home",
      label: t("navHome"),
      icon: "home",
      activePaths: ["/home"],
    },
    {
      href: "/home/cart",
      label: t("navShopping"),
      icon: "shopping_bag",
      activePaths: ["/home/cart", "/home/checkout", "/home/shopping"],
      badge: totalItems > 0 ? totalItems : undefined,
    },
    {
      href: "/home/orders",
      label: t("navOrders"),
      icon: "receipt_long",
      activePaths: ["/home/orders"],
    },
    {
      href: "/home/wallets",
      label: t("navWallets"),
      icon: "account_balance_wallet",
      activePaths: ["/home/wallets"],
    },
    {
      href: "/home/affiliate",
      label: t("navAffiliate"),
      icon: "group_work",
      activePaths: ["/home/affiliate"],
    },
    {
      href: "/home/profile",
      label: t("navAccount"),
      icon: "person",
      activePaths: ["/home/profile", "/home/account"],
    },
  ];

  const handleNavigate = (href: string) => {
    if (pathname === href) return;
    router.push(href);
  };

  const isActive = (item: typeof menuItems[0]) => {
    // Normalize pathname (remove trailing slash)
    const normalizedPathname = pathname.replace(/\/$/, '') || '/';
    
    return item.activePaths.some((path) => {
      // Normalize path (remove trailing slash)
      const normalizedPath = path.replace(/\/$/, '') || '/';
      
      // Exact match
      if (normalizedPathname === normalizedPath) return true;
      
      // Special case: /home should only match exactly /home, not sub-paths
      if (normalizedPath === "/home") {
        return normalizedPathname === "/home";
      }
      
      // For other paths, check if pathname starts with path + "/"
      return normalizedPathname.startsWith(normalizedPath + "/");
    });
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-lg border-t border-gray-200 z-[70] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center max-w-md mx-auto px-4 pt-3 pb-5 safe-area-inset-bottom">
        {menuItems.map((item) => {
          const active = isActive(item);

          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={`flex flex-col items-center gap-1 transition-all group relative min-w-[60px] px-2 py-1 rounded-lg ${
                active
                  ? "text-primary-dark bg-primary/10"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
              type="button"
              {...(item.href === "/home/cart" ? { "data-bottom-nav-cart": true } : {})}
            >
              <span className={`material-symbols-outlined text-[24px] transition-transform group-hover:scale-110 ${
                active ? "font-bold" : ""
              }`}>
                {item.icon}
              </span>
              {mounted && item.badge && (
                <span className="absolute top-0 right-1/2 translate-x-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white ring-2 ring-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
              <span className={`text-[10px] transition-all ${
                active ? "font-bold text-primary-dark" : "font-medium"
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
