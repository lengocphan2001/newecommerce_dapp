"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import WalletStatusChip from "@/app/components/WalletStatusChip";
import { api } from "@/app/services/api";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { useI18n } from "@/app/i18n/I18nProvider";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { addItem } = useShoppingCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(price);
  };

  const handleProductClick = (productId: string) => {
    router.push(`/home/products/${productId}`);
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      thumbnailUrl: product.thumbnailUrl,
    });
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col bg-[#f6f8f6] dark:bg-[#102216] min-h-screen pb-20">
      {/* Header */}
      <AppHeader titleKey="homeTitle" showMenu={true} showActions={true} />

      {/* Wallet Status Chip */}
      <WalletStatusChip walletAddress="0x123456789" walletName="SafePal" />

      {/* Search Bar */}
      <div className="px-4 pb-2">
        <div className="relative flex w-full items-center">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="material-symbols-outlined text-gray-400 dark:text-[#92c9a4]">search</span>
          </div>
          <input
            className="block w-full p-3 pl-10 text-sm text-gray-900 border border-transparent rounded-xl bg-gray-100 dark:bg-[#23482f] dark:placeholder-gray-400 dark:text-white focus:ring-[#13ec5b] focus:border-[#13ec5b] placeholder:text-gray-500"
            placeholder={t("searchProductsPlaceholder")}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Affiliate Promo Banner */}
        <div className="p-4">
          <div className="flex flex-col rounded-xl overflow-hidden shadow-lg bg-[#193322] relative group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-[#102216]/80 to-transparent z-10 pointer-events-none"></div>
            <div
              className="w-full h-40 bg-cover bg-center"
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCrk7J4sv4lRh4C-WbNBD2MwjaWm5aa-w17HArU1Md9USSMdDE48KKGPponID9p64un-gcB-JVApF-f45IlesRnkmLtbkLSOOGgCiYHdabTcAJHmYo-aLRyJn6nF4rpDo1vxtSKPonZh6aSMnj0_8eFoOnBTLshrpb2AXQj2hA7t-aLOndPn0sF1M7Gr650SxylYsZ4OWHmwdah0qDw2utnrMVnUlIr3mHZR-oyRxAjwBh1KC4YGg5_Bd3g3qfKxB7Tb1F7CKFGMqo")',
              }}
            ></div>
            <div className="absolute inset-0 z-20 flex flex-col justify-center p-5">
              <div className="inline-flex items-center gap-1 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#13ec5b] text-[#102216] uppercase tracking-wider">
                  Binary System
                </span>
              </div>
              <h2 className="text-white text-2xl font-bold leading-tight mb-1">
                Earn 5% Back
              </h2>
              <p className="text-gray-200 text-sm mb-4 max-w-[70%]">
                Get crypto rewards on every referral purchase in your network.
              </p>
              <button
                onClick={() => router.push("/home/affiliate")}
                className="w-fit px-4 py-2 bg-[#13ec5b] hover:bg-[#13ec5b]/90 text-[#102216] text-sm font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(19,236,91,0.3)]"
              >
                My Network
              </button>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="py-2">
          <div className="px-4 pb-3 flex justify-between items-end">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-none">
              Categories
            </h3>
            <a className="text-[#13ec5b] text-xs font-medium" href="#">
              See All
            </a>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                selectedCategory === "all"
                  ? "bg-[#13ec5b] shadow-sm"
                  : "bg-gray-100 dark:bg-[#193322] border border-transparent dark:border-white/5"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  selectedCategory === "all"
                    ? "text-[#102216]"
                    : "text-gray-600 dark:text-gray-300"
                }`}
              >
                grid_view
              </span>
              <span
                className={`text-sm font-bold ${
                  selectedCategory === "all"
                    ? "text-[#102216]"
                    : "text-gray-700 dark:text-gray-200 font-medium"
                }`}
              >
                All
              </span>
            </button>
            <button
              onClick={() => setSelectedCategory("food")}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                selectedCategory === "food"
                  ? "bg-[#13ec5b] shadow-sm"
                  : "bg-gray-100 dark:bg-[#193322] border border-transparent dark:border-white/5"
              }`}
            >
              <span className="text-gray-600 dark:text-gray-300 text-[20px]">🍎</span>
              <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                Fresh Food
              </span>
            </button>
            <button
              onClick={() => setSelectedCategory("drinks")}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                selectedCategory === "drinks"
                  ? "bg-[#13ec5b] shadow-sm"
                  : "bg-gray-100 dark:bg-[#193322] border border-transparent dark:border-white/5"
              }`}
            >
              <span className="text-gray-600 dark:text-gray-300 text-[20px]">🥤</span>
              <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                Drinks
              </span>
            </button>
            <button
              onClick={() => setSelectedCategory("household")}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                selectedCategory === "household"
                  ? "bg-[#13ec5b] shadow-sm"
                  : "bg-gray-100 dark:bg-[#193322] border border-transparent dark:border-white/5"
              }`}
            >
              <span className="text-gray-600 dark:text-gray-300 text-[20px]">🧻</span>
              <span className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                Household
              </span>
            </button>
          </div>
        </div>

        {/* Featured Products Grid */}
        <div className="px-4 pt-2 pb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Popular Goods
          </h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="group bg-white dark:bg-[#193322] rounded-xl overflow-hidden shadow-sm dark:shadow-[0_0_4px_rgba(0,0,0,0.2)] animate-pulse"
                >
                  <div className="relative aspect-square w-full bg-gray-100 dark:bg-white/5"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">{t("noProducts")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product.id)}
                  className="group bg-white dark:bg-[#193322] rounded-xl overflow-hidden shadow-sm dark:shadow-[0_0_4px_rgba(0,0,0,0.2)] hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="relative aspect-square w-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                    {product.thumbnailUrl ? (
                      <img
                        className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        src={product.thumbnailUrl}
                        alt={product.name}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">
                        📦
                      </div>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
                        SALE
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 min-h-[2.5em]">
                        {product.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 mb-3">
                      {product.stock > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#13ec5b]/20 text-[#13ec5b] font-medium">
                          Binary XP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-[#13ec5b]">
                          {formatPrice(product.price)}{" "}
                          <span className="text-xs">USDT</span>
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={product.stock <= 0}
                        className={`flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${
                          product.stock > 0
                            ? "bg-[#13ec5b] text-[#102216] hover:bg-[#13ec5b]/90 shadow-lg shadow-[#13ec5b]/20"
                            : "bg-gray-200 dark:bg-[#23482f] text-gray-600 dark:text-white"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
