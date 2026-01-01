"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";

export default function AccountPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navAccount" />
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <button
            onClick={() => router.push("/home/profile")}
            className="w-full rounded-xl bg-white p-4 text-left shadow-sm transition-colors hover:bg-zinc-50"
          >
            <div className="flex items-center gap-4">
              <div className="text-zinc-600">
                <svg
                  className="h-6 w-6"
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
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900">
                  Thông tin cá nhân
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Xem và chỉnh sửa thông tin tài khoản
                </p>
              </div>
              <div className="text-zinc-400">&gt;</div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}

