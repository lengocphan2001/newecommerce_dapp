"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "../components/BottomNav";
import AddToCartAnimation from "../components/AddToCartAnimation";
import { useShoppingCart } from "../contexts/ShoppingCartContext";
import { api } from "../services/api";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { animation } = useShoppingCart();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
  }, [router]);

  // Putting BottomNav here makes it persistent across /home tabs.
  // All pages will have header (from each page) and bottom nav (from layout)
  // Bottom nav height: ~80px (pt-3 pb-5 + safe area)
  return (
    <div className="flex min-h-screen flex-col bg-transparent">
      {/* Content area - each page renders its own header */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
      {/* Bottom Navigation - always visible on all pages */}
      <BottomNav />
      {/* Add to Cart Animation */}
      {animation && <AddToCartAnimation animation={animation} />}
    </div>
  );
}


