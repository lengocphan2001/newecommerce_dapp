"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import LanguageSelect from "@/app/components/LanguageSelect";
import { api } from "@/app/services/api";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { useI18n } from "@/app/i18n/I18nProvider";

interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

interface Slider {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  order: number;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  stock: number;
  shippingFee?: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  countries?: ('VIETNAM' | 'USA')[];
  categoryId?: string;
  category?: Category;
  createdAt: string;
  tags?: string[];
  salePercentage?: number;
  /** Commission % for referrer when buyer is TV. 0 or empty = not applicable. */
  commissionPercentTV?: number;
  /** Bật hoa hồng theo sản phẩm (khi true hiển thị Direct NPP). */
  useProductCommission?: boolean;
  /** Direct % khi buyer là NPP (dùng khi useProductCommission). */
  commissionPercentNPP?: number;
  /** Cấu hình hoa hồng theo gói (NPP.directCommissionRate 0–1). */
  commissionConfigByPackage?: Record<string, { directCommissionRate?: number }>;
}

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { addItem } = useShoppingCart();
  const [products, setProducts] = useState<Product[]>([]);

  // Helper to get localized content
  const getLocalizedContent = (viContent: string, enContent?: string) => {
    if (lang === 'vi') return viContent;
    return enContent || viContent;
  };
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<'VIETNAM' | 'USA' | null>('VIETNAM');
  const [selectedProductType, setSelectedProductType] = useState<'STRATEGIC' | 'COMMON' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [currentSliderIndex, setCurrentSliderIndex] = useState(0);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [flagImageError, setFlagImageError] = useState<{ vietnam: boolean; usa: boolean }>({
    vietnam: false,
    usa: false,
  });
  const [addToCartAnimating, setAddToCartAnimating] = useState<string | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const productsSectionRef = useRef<HTMLDivElement>(null);
  const filterChangedOnce = useRef(false);
  const fetchProductsRef = useRef<() => void>(() => { });

  // Lazy-load products when the products section scrolls into view
  useEffect(() => {
    fetchProductsRef.current = fetchProducts;
  });
  useEffect(() => {
    const el = productsSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchProductsRef.current();
      },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Refetch when user changes country or category (skip initial mount)
  useEffect(() => {
    if (!filterChangedOnce.current) {
      filterChangedOnce.current = true;
      return;
    }
    fetchProducts();
  }, [selectedCountry, selectedCategoryId, selectedProductType]);

  // Load categories, sliders, featured, referral song song (cache 10 phút cho categories/sliders)
  useEffect(() => {
    loadWalletInfo();
    Promise.allSettled([
      fetchCategories(),
      fetchSliders(),
      fetchFeaturedProducts(),
      loadReferralInfo(),
    ]);
  }, []);

  useEffect(() => {
    if (sliders.length > 0) {
      const interval = setInterval(() => {
        setCurrentSliderIndex((prev) => (prev + 1) % sliders.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [sliders.length]);

  const fetchCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(Array.isArray(data) ? (data as Category[]) : []);
    } catch (error) {
      console.error('Failed to fetch categories');
    }
  };

  const fetchSliders = async () => {
    try {
      const data = await api.getSliders(true);
      setSliders(Array.isArray(data) ? (data as Slider[]) : []);
    } catch (error) {
      console.error('Failed to fetch sliders');
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const data = await api.getFeaturedProducts({ compactHome: true });
      setFeaturedProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      setFeaturedProducts([]);
    }
  };

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
      // Fetch products with filters
      const data = await api.getProducts(
        selectedCountry || undefined,
        selectedCategoryId || undefined,
        selectedProductType || undefined,
        { compactHome: true },
      );
      let filtered = Array.isArray(data) ? data : [];

      // Additional frontend filtering if needed
      if (selectedCountry) {
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
      maximumFractionDigits: 4,
    }).format(price);
  };

  const handleProductClick = (productId: string) => {
    router.push(`/home/products/detail?id=${productId}`);
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (product.stock <= 0 || product.tags?.includes('COMING_SOON')) return;

    // Animation effect
    setAddToCartAnimating(product.id);
    setTimeout(() => setAddToCartAnimating(null), 600);

    // Pass button element for animation
    const buttonElement = e.currentTarget as HTMLElement;

    const finalPrice = product.salePercentage && product.salePercentage > 0
      ? product.price * (1 - product.salePercentage / 100)
      : product.price;

    addItem({
      productId: product.id,
      productName: getLocalizedContent(product.name, product.nameEn),
      price: finalPrice,
      thumbnailUrl: product.thumbnailUrl,
    }, buttonElement);
  };

  const featuredIds = new Set(featuredProducts.map((p) => p.id));
  const filteredProducts = products.filter((product) => {
    if (featuredIds.has(product.id)) return false; // don't show in grid when shown in title strip
    const displayName = getLocalizedContent(product.name, product.nameEn);
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

  const getFakeSold = (id: string) => {
    const count = Math.floor((Math.abs(id.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)) % 1950) + 50);
    return count > 1000 ? `${(count / 1000).toFixed(1)}k` : count;
  };

  return (
    <div className="flex flex-col bg-background-gray">
      {/* Header with search */}
      <AppHeader
        showMenu={true}
        showActions={true}
        right={<LanguageSelect variant="light" />}
        showSearch={true}
        searchPlaceholder={t("searchProductsPlaceholder")}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Page title + featured products strip (same row) */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex flex-row items-center gap-3 min-h-[3rem]">
        <h1
          className="text-lg font-bold tracking-tight truncate flex-shrink-0"
          style={{
            background: "linear-gradient(90deg, #10b981 0%, #059669 50%, #047857 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {t("homeTitle")}
        </h1>
        {featuredProducts.length > 0 && (
          <div className="flex gap-6 overflow-x-auto flex-1 min-w-0 justify-center scrollbar-hide">
            {featuredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleProductClick(p.id)}
                className="flex-shrink-0 flex flex-col items-center gap-1 rounded-lg overflow-hidden hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <img
                  src={p.thumbnailUrl || "/images/unnamed.png"}
                  alt={getLocalizedContent(p.name, p.nameEn)}
                  className="h-10 w-10 object-cover rounded"
                />
                <span className="text-[10px] font-medium text-gray-700 truncate max-w-[4rem] text-center leading-tight px-0.5">
                  {getLocalizedContent(p.name, p.nameEn)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Countries Filter */}

        {/* Slider Banner */}
        {sliders.length > 0 && (
          <div className="p-4 bg-white mb-2">
            <div className="relative rounded-2xl overflow-hidden shadow-md border border-gray-100">
              <div className="relative w-full h-44 overflow-hidden">
                {sliders.map((slider, index) => (
                  <div
                    key={slider.id}
                    className={`absolute inset-0 transition-opacity duration-500 ${index === currentSliderIndex ? 'opacity-100' : 'opacity-0'
                      }`}
                    style={{
                      backgroundImage: `url("${slider.imageUrl}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {(slider.title || slider.description) && (
                      <div className="w-full h-full bg-gradient-to-r from-gray-900/90 to-gray-900/10 p-5 flex flex-col justify-center">
                        {slider.title && (
                          <h2 className="text-white text-2xl font-bold leading-tight mb-1">{slider.title}</h2>
                        )}
                        {slider.description && (
                          <p className="text-gray-100 text-sm mb-4 max-w-[80%] font-medium drop-shadow-sm">{slider.description}</p>
                        )}
                        {slider.linkUrl && (
                          <button
                            onClick={() => {
                              if (slider.linkUrl?.startsWith('/')) {
                                router.push(slider.linkUrl);
                              } else {
                                window.open(slider.linkUrl, '_blank');
                              }
                            }}
                            className="w-fit px-5 py-2.5 bg-white text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg active:scale-95 relative overflow-hidden group"
                          >
                            <span className="relative z-10">View More</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-active:translate-x-full transition-transform duration-500"></div>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Slider Indicators */}
              {sliders.length > 1 && (
                <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
                  {sliders.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSliderIndex(index)}
                      className={`h-2 rounded-full transition-all ${index === currentSliderIndex
                        ? 'w-6 bg-white'
                        : 'w-2 bg-white/50 hover:bg-white/75'
                        }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              )}
              {/* Navigation Arrows */}
              {sliders.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentSliderIndex((prev) => (prev - 1 + sliders.length) % sliders.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full shadow-lg transition-all flex items-center justify-center z-10"
                    aria-label="Previous slide"
                  >
                    <span className="material-symbols-outlined text-gray-900 text-xl leading-none">chevron_left</span>
                  </button>
                  <button
                    onClick={() => setCurrentSliderIndex((prev) => (prev + 1) % sliders.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm rounded-full shadow-lg transition-all flex items-center justify-center z-10"
                    aria-label="Next slide"
                  >
                    <span className="material-symbols-outlined text-gray-900 text-xl leading-none">chevron_right</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {/* Sticky Filter Row */}
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 flex-1">
            <button
              onClick={() => setSelectedProductType(null)}
              className={`flex-1 flex items-center justify-center py-2 rounded-xl text-[12px] font-bold transition-all ${selectedProductType === null
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-600"
                }`}
            >
              {lang === 'vi' ? 'Tất cả' : 'All'}
            </button>
            <button
              onClick={() => setSelectedProductType("STRATEGIC")}
              className={`flex-1 flex items-center justify-center py-2 rounded-xl text-[12px] font-bold transition-all ${selectedProductType === "STRATEGIC"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-600"
                }`}
            >
              {lang === 'vi' ? 'Chiến lược' : 'Strategic'}
            </button>
            <button
              onClick={() => setSelectedProductType("COMMON")}
              className={`flex-1 flex items-center justify-center py-2 rounded-xl text-[12px] font-bold transition-all ${selectedProductType === "COMMON"
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-600"
                }`}
            >
              {lang === 'vi' ? 'Thông dụng' : 'Common'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setFilterModalOpen(true)}
            className="flex items-center justify-center h-10 w-10 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors text-slate-600 shrink-0"
            title={t("filter") || "Filter"}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

        {/* Filter modal */}
        {filterModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            aria-modal="true"
            role="dialog"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setFilterModalOpen(false)}
            />
            <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">{t("filter") || "Filter"}</h3>
                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-6">
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-3">{t("countries")}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => toggleCountry("VIETNAM")}
                      className={`flex flex-1 items-center gap-2 rounded-xl border-2 p-3 transition-all ${selectedCountry === "VIETNAM"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                    >
                      {flagImageError.vietnam ? (
                        <span className="text-2xl">🇻🇳</span>
                      ) : (
                        <img src="https://flagcdn.com/w40/vn.png" alt="" className="w-8 h-8 object-contain rounded" onError={() => setFlagImageError((prev) => ({ ...prev, vietnam: true }))} />
                      )}
                      <span className="font-semibold text-sm">Vietnam</span>
                    </button>
                    <button
                      onClick={() => toggleCountry("USA")}
                      className={`flex flex-1 items-center gap-2 rounded-xl border-2 p-3 transition-all ${selectedCountry === "USA"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                    >
                      {flagImageError.usa ? (
                        <span className="text-2xl">🇺🇸</span>
                      ) : (
                        <img src="https://flagcdn.com/w40/us.png" alt="" className="w-8 h-8 object-contain rounded" onError={() => setFlagImageError((prev) => ({ ...prev, usa: true }))} />
                      )}
                      <span className="font-semibold text-sm">USA</span>
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-700 mb-3">{lang === 'vi' ? 'Loại sản phẩm' : 'Product Type'}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedProductType(selectedProductType === "STRATEGIC" ? null : "STRATEGIC")}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all ${selectedProductType === "STRATEGIC"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                    >
                      <span className="material-symbols-outlined text-xl">star</span>
                      <span className="font-semibold text-sm">{lang === 'vi' ? 'Chiến lược' : 'Strategic'}</span>
                    </button>
                    <button
                      onClick={() => setSelectedProductType(selectedProductType === "COMMON" ? null : "COMMON")}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 p-3 transition-all ${selectedProductType === "COMMON"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                    >
                      <span className="material-symbols-outlined text-xl">category</span>
                      <span className="font-semibold text-sm">{lang === 'vi' ? 'Thông dụng' : 'Common'}</span>
                    </button>
                  </div>
                </div>

                {categories.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-3">Categories</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategoryId(null)}
                        className={`shrink-0 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${selectedCategoryId === null ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                      >
                        {t("all")}
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategoryId(cat.id)}
                          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${selectedCategoryId === cat.id ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                        >
                          {cat.imageUrl && <img src={cat.imageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setFilterModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition-colors"
                >
                  {t("apply") || "Apply"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Featured Products Grid — lazy-loaded when this section is in view */}
        <div ref={productsSectionRef} className="px-4 pt-4 pb-8 bg-white">
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

                    {product.stock <= 0 && !product.tags?.includes('COMING_SOON') && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-gray-500 text-white text-[10px] font-bold rounded shadow-sm z-10">
                        {t("soldOut")}
                      </div>
                    )}
                    {product.tags?.includes('SALE') && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded shadow-sm z-10">
                        SALE
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-2 min-h-[1.5em]">
                        {getLocalizedContent(product.name, product.nameEn)}
                      </h4>
                    </div>

                    {product.tags?.includes('COMING_SOON') && (
                      <div className="mb-2">
                        <span className="inline-block px-3 py-1 bg-red-600 text-white text-[10px] uppercase font-bold rounded-sm">
                          {lang === 'vi' ? 'Sắp ra mắt' : 'Coming Soon'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      {product.stock > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">{t("binaryXP")}</span>
                      ) : (
                        <span className="text-[10px] py-0.5 opacity-0">Spacer</span>
                      )}

                      <span className="text-[10px] text-gray-500 font-medium ml-auto">
                        {t("sold")} {getFakeSold(product.id)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        {product.salePercentage && product.salePercentage > 0 ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs text-gray-400 line-through">
                                {formatPrice(product.price)}
                              </span>
                              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded leading-none">
                                -{product.salePercentage}%
                              </span>
                            </div>
                            <p className="text-lg font-bold text-red-600 leading-none">
                              {formatPrice(product.price * (1 - product.salePercentage / 100))} <span className="text-[10px] font-normal text-red-600">PV</span>
                            </p>
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-primary-dark">
                            {formatPrice(product.price)} <span className="text-xs font-normal text-gray-500">PV</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={product.stock <= 0 || !!product.tags?.includes('COMING_SOON')}
                        className={`flex items-center justify-center h-9 w-9 rounded-full transition-all ${product.stock > 0
                          ? "bg-primary text-white hover:bg-primary-dark shadow-md shadow-emerald-500/30 active:scale-90"
                          : "bg-gray-100 text-gray-600 hover:bg-primary hover:text-white"
                          } ${addToCartAnimating === product.id ? 'ring-4 ring-emerald-300 animate-pulse' : ''}`}
                      >
                        <span className={`material-symbols-outlined text-[20px] transition-transform ${addToCartAnimating === product.id ? 'scale-125' : ''}`}>
                          {addToCartAnimating === product.id ? 'check' : 'add'}
                        </span>
                      </button>
                    </div>
                    {(() => {
                      const useProductCommission = product.useProductCommission === true;
                      // Khi bật hoa hồng sản phẩm: dùng đúng directCommissionRate từ tab "Hoa hồng sản phẩm" (commissionConfigByPackage.NPP). DB lưu 0–1 → *100 để hiển thị %.
                      let displayPercent: number;
                      if (useProductCommission) {
                        const nppDirect = product.commissionConfigByPackage?.NPP?.directCommissionRate;
                        if (nppDirect != null) {
                          const v = Number(nppDirect);
                          displayPercent = v <= 1 ? v * 100 : v;
                        } else {
                          const pct = Number(product.commissionPercentNPP);
                          displayPercent = Number.isFinite(pct) ? pct : 0;
                        }
                      } else {
                        const pct = Number(product.commissionPercentTV);
                        displayPercent = Number.isFinite(pct) ? pct : 0;
                      }
                      if (!Number.isFinite(displayPercent) || displayPercent <= 0) return null;
                      return (
                        <p className="text-xs font-semibold text-red-600 mt-2 pt-2 border-t border-gray-100">
                          {t("commissionRateLabel")} {Number(displayPercent).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                        </p>
                      );
                    })()}
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
