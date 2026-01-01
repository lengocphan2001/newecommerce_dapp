"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";

export default function ShoppingPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to cart page
    router.push("/home/cart");
  }, [router]);

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navShopping" />
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-2xl px-4 py-8 text-center">
          <p className="text-zinc-500">Đang chuyển hướng...</p>
        </div>
      </main>
    </div>
  );
}

