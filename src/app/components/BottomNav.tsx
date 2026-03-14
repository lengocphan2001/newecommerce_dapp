"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [pressedHref, setPressedHref] = useState<string | null>(null);

  useEffect(() => {
    setPressedHref(null);
  }, [pathname]);

  const menuItems = [
    { href: "/home", label: t("navHome"), icon: "home", activePaths: ["/home"] },
    { href: "/home/orders", label: t("navOrders"), icon: "receipt_long", activePaths: ["/home/orders"] },
    { href: "/home/wallets", label: t("navWallets"), icon: "account_balance_wallet", activePaths: ["/home/wallets"] },
    { href: "/home/affiliate", label: t("navAffiliate"), icon: "group_work", activePaths: ["/home/affiliate"] },
    { href: "/home/profile", label: t("navAccount"), icon: "person", activePaths: ["/home/profile", "/home/account"] },
  ];

  const isActive = (item: (typeof menuItems)[0]) => {
    const normalizedPathname = pathname.replace(/\/$/, "") || "/";
    return item.activePaths.some((path) => {
      const normalizedPath = path.replace(/\/$/, "") || "/";
      if (normalizedPathname === normalizedPath) return true;
      if (normalizedPath === "/home") return normalizedPathname === "/home";
      return normalizedPathname.startsWith(normalizedPath + "/");
    });
  };

  const handleNavigate = (href: string) => {
    const normalizedPathname = pathname.replace(/\/$/, "") || "/";
    const normalizedHref = href.replace(/\/$/, "") || "/";
    if (normalizedPathname === normalizedHref) return;
    setPressedHref(href);
    router.push(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-lg border-t border-gray-200 z-[70] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex justify-between items-center max-w-md mx-auto px-4 pt-3 pb-5 safe-area-inset-bottom">
        {menuItems.map((item) => {
          const active = isActive(item) || pressedHref === item.href;

          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleNavigate(item.href)}
              className={`flex flex-col items-center gap-1 transition-all duration-150 ease-out group relative min-w-[60px] px-2 py-1 rounded-lg touch-manipulation ${
                active
                  ? "text-primary-dark bg-primary/10"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[24px] transition-transform duration-150 group-hover:scale-110 ${
                  active ? "font-bold" : ""
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[10px] transition-all duration-150 ${
                  active ? "font-bold text-primary-dark" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
