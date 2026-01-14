"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import WalletStatusChip from "@/app/components/WalletStatusChip";
import LanguageSelect from "@/app/components/LanguageSelect";
import { api } from "@/app/services/api";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { useI18n } from "@/app/i18n/I18nProvider";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  shippingFee?: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  countries?: ('VIETNAM' | 'USA')[];
  createdAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const { addItem } = useShoppingCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<'VIETNAM' | 'USA' | null>('VIETNAM');
  const [flagImageError, setFlagImageError] = useState<{ vietnam: boolean; usa: boolean }>({
    vietnam: false,
    usa: false,
  });
  const [addToCartAnimating, setAddToCartAnimating] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    loadWalletInfo();
    loadReferralInfo();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCountry]);

  const loadWalletInfo = () => {
    if (typeof window !== "undefined") {
      const storedAddr = localStorage.getItem("walletAddress") || "";
      setWalletAddress(storedAddr);
    }
  };

  const loadReferralInfo = async () => {
    try {
      const info = await api.getReferralInfo();
      setReferralInfo(info);
      if (info.walletAddress) {
        setWalletAddress(info.walletAddress);
      }
    } catch (err) {
      // User might not be logged in
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Fetch all products, then filter by selected country on frontend
      const data = await api.getProducts();
      let filtered = Array.isArray(data) ? data : [];
      
      // Default: only show Vietnam products if no country selected
      if (!selectedCountry) {
        filtered = filtered.filter((product) => {
          const productCountries = product.countries || [];
          return Array.isArray(productCountries) && productCountries.includes('VIETNAM');
        });
      } else {
        // Filter by selected country
        filtered = filtered.filter((product) => {
          const productCountries = product.countries || [];
          return Array.isArray(productCountries) && productCountries.includes(selectedCountry);
        });
      }
      
      setProducts(filtered);
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
    router.push(`/home/products/detail?id=${productId}`);
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    
    // Animation effect
    setAddToCartAnimating(product.id);
    setTimeout(() => setAddToCartAnimating(null), 600);
    
    // Pass button element for animation
    const buttonElement = e.currentTarget as HTMLElement;
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      thumbnailUrl: product.thumbnailUrl,
    }, buttonElement);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCountryLabel = (country: 'VIETNAM' | 'USA' | null) => {
    if (!country) return t("popularGoods");
    return country === 'VIETNAM' ? 'Vietnam Local Products' : 'USA Local Products';
  };

  const toggleCountry = (country: 'VIETNAM' | 'USA') => {
    setSelectedCountry(prev => {
      // If clicking the same country, deselect it (show default Vietnam)
      if (prev === country) {
        return 'VIETNAM'; // Always default to Vietnam when deselecting
      }
      // Otherwise, select the clicked country
      return country;
    });
  };

  return (
    <div className="flex flex-col bg-background-gray">
      {/* Header */}
      <AppHeader 
        titleKey="homeTitle" 
        showMenu={true} 
        showActions={true}
        right={<LanguageSelect variant="light" />}
      />

      {/* Wallet Status Chip */}
      <WalletStatusChip walletAddress={walletAddress || undefined} walletName="SafePalMall" />

      {/* Search Bar */}
      <div className="px-4 py-4 bg-white shadow-sm mb-2">
        <div className="relative flex w-full items-center">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="material-symbols-outlined text-gray-400">search</span>
          </div>
          <input
            className="block w-full p-3.5 pl-10 text-base text-gray-900 border border-gray-200 rounded-xl bg-gray-50 focus:ring-primary focus:border-primary placeholder:text-gray-400 shadow-inner"
            placeholder={t("searchProductsPlaceholder")}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Countries Filter */}

        {/* Affiliate Promo Banner */}
        <div className="p-4 bg-white mb-2">
          <div className="flex flex-col @container rounded-2xl overflow-hidden shadow-md bg-white relative group border border-gray-100">
            <div className="w-full h-44 bg-cover bg-center" style={{
              backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCrk7J4sv4lRh4C-WbNBD2MwjaWm5aa-w17HArU1Md9USSMdDE48KKGPponID9p64un-gcB-JVApF-f45IlesRnkmLtbkLSOOGgCiYHdabTcAJHmYo-aLRyJn6nF4rpDo1vxtSKPonZh6aSMnj0_8eFoOnBTLshrpb2AXQj2hA7t-aLOndPn0sF1M7Gr650SxylYsZ4OWHmwdah0qDw2utnrMVnUlIr3mHZR-oyRxAjwBh1KC4YGg5_Bd3g3qfKxB7Tb1F7CKFGMqo")',
            }}>
              <div className="w-full h-full bg-gradient-to-r from-gray-900/90 to-gray-900/10 p-5 flex flex-col justify-center">
                <div className="inline-flex items-center gap-1 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white border border-white/30 backdrop-blur-sm uppercase tracking-wider">{t("binarySystem")}</span>
                </div>
                <h2 className="text-white text-2xl font-bold leading-tight mb-1">{t("earn5Back")}</h2>
                <p className="text-gray-100 text-sm mb-4 max-w-[80%] font-medium drop-shadow-sm">Get crypto rewards on every referral purchase in your network.</p>
                <button
                  onClick={() => router.push("/home/affiliate")}
                  className="w-fit px-5 py-2.5 bg-white text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg active:scale-95 relative overflow-hidden group"
                >
                  <span className="relative z-10">{t("myNetwork")}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-active:translate-x-full transition-transform duration-500"></div>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white mb-2 pt-4">
          <div className="flex justify-between items-center px-4 mb-4">
            <h3 className="text-lg font-bold text-text-dark leading-none">{t("countries")}</h3>
          </div>
          <div className="flex gap-6 px-4 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => toggleCountry('VIETNAM')}
              className={`flex shrink-0 flex-col items-center gap-2 min-w-[72px] ${
                selectedCountry === 'VIETNAM' ? '' : 'group'
              }`}
            >
              <div className={`w-16 h-16 rounded-full bg-white ${
                selectedCountry === 'VIETNAM'
                  ? 'border-2 border-primary p-0.5 flex items-center justify-center shadow-lg shadow-primary/20'
                  : 'border border-gray-200 p-0.5 flex items-center justify-center group-hover:border-gray-300 transition-all shadow-sm'
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                  {flagImageError.vietnam ? (
                    <span className="text-3xl">🇻🇳</span>
                  ) : (
                    <img 
                      src="https://flagcdn.com/w40/vn.png" 
                      alt="Vietnam" 
                      className="w-10 h-10 object-contain"
                      onError={() => setFlagImageError(prev => ({ ...prev, vietnam: true }))}
                    />
                  )}
                </div>
              </div>
              <span className={`text-xs ${
                selectedCountry === 'VIETNAM' 
                  ? 'text-primary font-bold' 
                  : 'text-gray-600 font-medium group-hover:text-text-dark transition-colors'
              }`}>
                Vietnam
              </span>
            </button>
            <button
              onClick={() => toggleCountry('USA')}
              className={`flex shrink-0 flex-col items-center gap-2 min-w-[72px] ${
                selectedCountry === 'USA' ? '' : 'group'
              }`}
            >
              <div className={`w-16 h-16 rounded-full bg-white ${
                selectedCountry === 'USA'
                  ? 'border-2 border-primary p-0.5 flex items-center justify-center shadow-lg shadow-primary/20'
                  : 'border border-gray-200 p-0.5 flex items-center justify-center group-hover:border-gray-300 transition-all shadow-sm'
              }`}>
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
                  {flagImageError.usa ? (
                    <span className="text-3xl">🇺🇸</span>
                  ) : (
                    <img 
                      src="https://flagcdn.com/w40/us.png" 
                      alt="USA" 
                      className="w-10 h-10 object-contain"
                      onError={() => setFlagImageError(prev => ({ ...prev, usa: true }))}
                    />
                  )}
                </div>
              </div>
              <span className={`text-xs ${
                selectedCountry === 'USA'
                  ? 'text-primary font-bold'
                  : 'text-gray-600 font-medium group-hover:text-text-dark transition-colors'
              }`}>
                USA
              </span>
            </button>
          </div>
        </div>

        

        {/* Featured Products Grid */}
        <div className="px-4 pt-4 pb-8 bg-white">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-text-dark">{getCountryLabel(selectedCountry)}</h3>
            <span className="text-xs text-gray-500 font-medium">{filteredProducts.length} items found</span>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="group bg-white rounded-xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 animate-pulse"
                >
                  <div className="relative aspect-square w-full bg-gray-50"></div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">{t("noProducts")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product.id)}
                  className="group bg-white rounded-xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 hover:border-primary/30 transition-all hover:shadow-lg"
                >
                  <div className="relative aspect-square w-full bg-gray-50 overflow-hidden">
                    {product.thumbnailUrl ? (
                      <img
                        className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                        src={product.thumbnailUrl}
                        alt={product.name}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl">
                        📦
                      </div>
                    )}
                    <button className="absolute top-2 right-2 bg-white/80 hover:bg-white backdrop-blur-md p-1.5 rounded-full text-gray-400 hover:text-red-500 transition-colors shadow-sm">
                      <span className="material-symbols-outlined text-[18px]">favorite</span>
                    </button>
                    {product.stock <= 0 && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded shadow-sm">{t("sale")}</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-2 min-h-[2.5em]">
                        {product.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 mb-3">
                      {product.stock > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">{t("binaryXP")}</span>
                      ) : (
                        <span className="text-[10px] py-0.5 opacity-0">Spacer</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-primary-dark">
                          {formatPrice(product.price)} <span className="text-xs font-normal text-gray-500">USDT</span>
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={product.stock <= 0}
                        className={`flex items-center justify-center h-9 w-9 rounded-full transition-all ${
                          product.stock > 0
                            ? "bg-primary text-white hover:bg-primary-dark shadow-md shadow-purple-500/30 active:scale-90"
                            : "bg-gray-100 text-gray-600 hover:bg-primary hover:text-white"
                        } ${addToCartAnimating === product.id ? 'ring-4 ring-purple-300 animate-pulse' : ''}`}
                      >
                        <span className={`material-symbols-outlined text-[20px] transition-transform ${addToCartAnimating === product.id ? 'scale-125' : ''}`}>
                          {addToCartAnimating === product.id ? 'check' : 'add'}
                        </span>
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
