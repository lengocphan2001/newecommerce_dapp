"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";

export default function HeaderActions() {
  const router = useRouter();
  const { totalItems } = useShoppingCart();

  return (
    <>
      <button
        onClick={() => router.push("/home/cart")}
        className="relative rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100"
      >
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
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {totalItems}
          </span>
        )}
      </button>
    </>
  );
}

