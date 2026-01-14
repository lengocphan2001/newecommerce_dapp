"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { api } from "@/app/services/api";

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  thumbnailUrl?: string;
  stock: number;
  shippingFee?: number;
  countries?: ('VIETNAM' | 'USA')[];
}

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<('VIETNAM' | 'USA')[]>([]);
  const [flagImageError, setFlagImageError] = useState<{ vietnam: boolean; usa: boolean }>({
    vietnam: false,
    usa: false,
  });
  const [addToCartAnimating, setAddToCartAnimating] = useState<string | null>(null);
  const { t } = useI18n();
  const { addItem } = useShoppingCart();
  const router = useRouter();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCountries]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.getProducts();
      let filtered = Array.isArray(response) ? response : response.data || [];
      
      // Filter by selected countries if any
      if (selectedCountries.length > 0) {
        filtered = filtered.filter((product: Product) => {
          const productCountries = product.countries || [];
          return selectedCountries.some(country => 
            Array.isArray(productCountries) && productCountries.includes(country)
          );
        });
      }
      
      setProducts(filtered);
    } catch (err: any) {
      setError(err.message || t("failedToLoadProducts"));
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

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.stock <= 0) {
      return;
    }
    
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

  const handleProductClick = (productId: string) => {
    router.push(`/home/products/detail?id=${productId}`);
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCountryLabel = (countries: ('VIETNAM' | 'USA')[]) => {
    if (countries.length === 0) return t("productsTitle");
    if (countries.length === 1) {
      return countries[0] === 'VIETNAM' ? 'Vietnam Local Products' : 'USA Local Products';
    }
    return 'All Selected Products';
  };

  const toggleCountry = (country: 'VIETNAM' | 'USA') => {
    setSelectedCountries(prev => {
      if (prev.includes(country)) {
        return prev.filter(c => c !== country);
      } else {
        return [...prev, country];
      }
    });
  };

  return (
    <div className="flex flex-col bg-background-gray">
      <AppHeader titleKey="productsTitle" />
      
      {/* Search Bar */}
      <div className="px-4 py-4 bg-white shadow-sm mb-2">
        <div className="relative flex w-full items-center">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <span className="material-symbols-outlined text-gray-400">search</span>
          </div>
          <input
            className="block w-full p-3.5 pl-10 text-sm text-gray-900 border border-gray-200 rounded-xl bg-gray-50 focus:ring-primary focus:border-primary placeholder:text-gray-400 shadow-inner"
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
        <div className="bg-white mb-2 pt-4">
          <div className="flex justify-between items-center px-4 mb-4">
            <h3 className="text-lg font-bold text-text-dark leading-none">{t("countries")}</h3>
          </div>
          <div className="flex gap-6 px-4 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => toggleCountry('VIETNAM')}
              className={`flex shrink-0 flex-col items-center gap-2 min-w-[72px] ${
                selectedCountries.includes('VIETNAM') ? '' : 'group'
              }`}
            >
              <div className={`w-16 h-16 rounded-full bg-white ${
                selectedCountries.includes('VIETNAM')
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
                selectedCountries.includes('VIETNAM') 
                  ? 'text-primary font-bold' 
                  : 'text-gray-600 font-medium group-hover:text-text-dark transition-colors'
              }`}>
                Vietnam
              </span>
            </button>
            <button
              onClick={() => toggleCountry('USA')}
              className={`flex shrink-0 flex-col items-center gap-2 min-w-[72px] ${
                selectedCountries.includes('USA') ? '' : 'group'
              }`}
            >
              <div className={`w-16 h-16 rounded-full bg-white ${
                selectedCountries.includes('USA')
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
                selectedCountries.includes('USA')
                  ? 'text-primary font-bold'
                  : 'text-gray-600 font-medium group-hover:text-text-dark transition-colors'
              }`}>
                USA
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-4 pt-4 pb-8 bg-white">
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
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-red-500 bg-white">{error}</div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500 bg-white">
            {t("noProducts")}
          </div>
        ) : (
          <div className="px-4 pt-4 pb-8 bg-white">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-text-dark">{getCountryLabel(selectedCountries)}</h3>
              <span className="text-xs text-gray-500 font-medium">{filteredProducts.length} items found</span>
            </div>
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
                      <div className="absolute top-2 left-2 px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded shadow-sm">
                        {t("sale")}
                      </div>
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
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">
                          {t("binaryXP")}
                        </span>
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
                    {product.stock > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        {t("stockAvailable").replace("{count}", product.stock.toString())}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
