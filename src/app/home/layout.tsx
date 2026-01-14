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
    // Check if user has token and wallet address
    const token = localStorage.getItem("token");
    const walletAddress = localStorage.getItem("walletAddress");

    if (!token || !walletAddress) {
      // Try to auto-login if wallet exists
      if (walletAddress) {
        api.walletLogin(walletAddress)
          .then((result) => {
            if (result.token) {
              localStorage.setItem("token", result.token);
              // Stay on home page
            } else {
              // No token, redirect to login
              router.push("/");
            }
          })
          .catch(() => {
            // Login failed, redirect to login
            router.push("/");
          });
      } else {
        // No wallet, redirect to login
        router.push("/");
      }
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


