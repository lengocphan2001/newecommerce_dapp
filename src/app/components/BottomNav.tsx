"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  const menuItems = [
    {
      href: "/home",
      label: t("navHome"),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      href: "/home/affiliate",
      label: t("navAffiliate"),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      href: "/home/shopping",
      label: t("navShopping"),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      href: "/home/orders",
      label: t("navOrders"),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
    },
    {
      href: "/home/wallets",
      label: t("navWallets"),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      href: "/home/account",
      label: t("navAccount"),
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  const handleNavigate = (href: string) => {
    // Prevent navigation if already on that page
    if (pathname === href) return;
    
    // Use Next.js router to preserve state and avoid full page reload
    router.push(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] border-t border-zinc-200 bg-white shadow-lg safe-area-inset-bottom">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {menuItems.map((item) => {
          // Shopping should be active for /home/shopping, /home/cart, and /home/checkout
          let isActive = pathname === item.href || (item.href === "/home" && pathname === "/home");
          if (item.href === "/home/shopping") {
            isActive = pathname === "/home/shopping" || pathname === "/home/cart" || pathname === "/home/checkout";
          }
          return (
            <button
              key={item.href}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleNavigate(item.href);
              }}
              onTouchStart={(e) => {
                // Prevent double-tap zoom on mobile
                e.currentTarget.style.touchAction = "manipulation";
              }}
              disabled={isActive}
              className={`relative flex min-h-[60px] min-w-[60px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all active:scale-95 ${
                isActive
                  ? "text-blue-600"
                  : "text-zinc-500 active:bg-zinc-100"
              }`}
              type="button"
              style={{
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div
                className={`${isActive ? "text-blue-600" : "text-zinc-500"}`}
              >
                {item.icon}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
