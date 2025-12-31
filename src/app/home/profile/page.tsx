"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ProfilePage() {
  const pathname = usePathname();

  const menuItems = [
    {
      href: "/home",
      label: "Trang chủ",
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
      href: "/home/products",
      label: "Sản phẩm",
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
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      href: "/home/orders",
      label: "Đơn hàng",
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      href: "/home/profile",
      label: "Cá nhân",
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

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <main className="flex-1 pb-20">
        <div className="mx-auto max-w-2xl px-6 py-10">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h1 className="text-2xl font-semibold tracking-tight">
              Cá nhân
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Thông tin cá nhân và cài đặt sẽ được hiển thị ở đây.
            </p>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-4 py-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-lg px-4 py-2 transition-colors ${
                  isActive
                    ? "text-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <div
                  className={`${isActive ? "text-zinc-900" : "text-zinc-500"}`}
                >
                  {item.icon}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
