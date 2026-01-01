"use client";

import React from "react";
import AppHeader from "@/app/components/AppHeader";

export default function ShoppingPage() {
  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navShopping" />
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center">
          <p className="text-zinc-500">Trang mua sắm đang được phát triển</p>
        </div>
      </main>
    </div>
  );
}

