"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/services/api";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { useI18n } from "@/app/i18n/I18nProvider";

interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
}

interface Product {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  price: number;
  stock: number;
  shippingFee?: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  categoryId?: string;
  category?: Category;
  categoryBreadcrumb?: string[];
  countries?: ('VIETNAM' | 'USA')[];
  createdAt: string;
  soldCount?: number;
  brand?: string;
  brandEn?: string;
  origin?: string;
  originEn?: string;
  clothingType?: string;
  clothingTypeEn?: string;
  tags?: string[];
  properties?: { name: string; values: string[] }[];
  combos?: { quantity: number; price: number; label?: string }[];
  fakeSold?: number;
  salePercentage?: number;
}

// Helper to generate consistent fake sold count
const getFakeSold = (id: string) => {
  return Math.floor((Math.abs(id.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0)) % 1950) + 50);
};

export default function ProductDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useI18n();
  const productId = searchParams.get('id') as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, string>>({});
  const [selectedCombo, setSelectedCombo] = useState<{ quantity: number; price: number; label?: string } | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const { addItem, totalItems } = useShoppingCart();
  const sliderRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);

  // Helper to get localized content
  const getLocalizedContent = (viContent?: string, enContent?: string) => {
    if (!viContent && !enContent) return ""; // Handle cases where both are undefined/null
    if (lang === 'vi') return viContent || enContent || ""; // Prefer VI, fallback to EN
    return enContent || viContent || ""; // Prefer EN, fallback to VI
  };

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Non-passive touchmove so preventDefault() works when swiping (avoids console warning)
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current !== null) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  // Compute all images from product
  const allImages = product
    ? [
      product.thumbnailUrl,
      ...(product.detailImageUrls || []),
    ].filter(Boolean) as string[]
    : [];

  // Swipe handlers with smooth drag
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    if (allImages.length <= 1) return;
    setTouchEnd(null);
    const x = e.targetTouches[0].clientX;
    setTouchStart(x);
    touchStartRef.current = x;
    setDragOffset(0);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || allImages.length <= 1) return;
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart;
    // Limit drag to prevent over-scrolling
    const maxDrag = typeof window !== 'undefined' ? window.innerWidth * 0.3 : 150;
    const limitedDiff = Math.max(-maxDrag, Math.min(maxDrag, diff));
    setDragOffset(limitedDiff);
    setTouchEnd(currentX);
  };

  const onTouchEnd = () => {
    if (!touchStart || allImages.length <= 1) {
      touchStartRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const distance = touchStart - (touchEnd || touchStart);
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setSelectedImageIndex((prev) => (prev + 1) % allImages.length);
    } else if (isRightSwipe) {
      setSelectedImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    }

    // Reset states
    touchStartRef.current = null;
    setTouchStart(null);
    setTouchEnd(null);
    setDragOffset(0);
    setIsDragging(false);
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const data = await api.getProduct(productId);
      setProduct(data);
      // Initialize selected properties
      if (data?.properties) {
        const initialProps: Record<string, string> = {};
        data.properties.forEach((p: { name: string; values: string[] }) => {
          if (p.values.length > 0) {
            initialProps[p.name] = p.values[0];
          }
        });
        setSelectedProperties(initialProps);
      }

      // Fetch related products
      try {
        const allProducts = await api.getProducts();
        const productsList = Array.isArray(allProducts)
          ? allProducts
          : ((allProducts as { data?: unknown[] })?.data ?? []);
        // Filter out current product and take max 2
        const related = productsList
          .filter((p: Product) => p.id !== productId)
          .slice(0, 2);
        setRelatedProducts(related);
      } catch (error) {
        setRelatedProducts([]);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const [usdtToVnd, setUsdtToVnd] = useState<number>(25000);

  useEffect(() => {
    let cancelled = false;
    api.getBankingConfig()
      .then((config) => {
        if (cancelled) return;
        const adminRate = config?.usdtPriceVnd;
        if (typeof adminRate === "number" && adminRate > 0) {
          setUsdtToVnd(adminRate);
        } else {
          fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd")
            .then((r) => r.json())
            .then((data: { tether?: { vnd?: number } }) => {
              if (cancelled) return;
              const rate = data?.tether?.vnd;
              if (typeof rate === "number" && rate > 0) {
                setUsdtToVnd(rate);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (!product || product.stock === 0 || product.tags?.includes('COMING_SOON')) return;
    const buttonElement = e?.currentTarget as HTMLElement;

    if (selectedCombo) {
      // Add combo: add item once per quantity in the combo
      for (let i = 0; i < selectedCombo.quantity; i++) {
        addItem({
          productId: product.id,
          productName: getLocalizedContent(product.name, product.nameEn),
          // Distribute combo price evenly across units
          price: parseFloat((selectedCombo.price / selectedCombo.quantity).toFixed(6)),
          thumbnailUrl: product.thumbnailUrl,
          properties: Object.keys(selectedProperties).length > 0 ? selectedProperties : undefined,
        }, buttonElement);
      }
      return;
    }

    const finalPrice = product.salePercentage && product.salePercentage > 0
      ? product.price * (1 - product.salePercentage / 100)
      : product.price;

    addItem({
      productId: product.id,
      productName: getLocalizedContent(product.name, product.nameEn),
      price: finalPrice,
      thumbnailUrl: product.thumbnailUrl,
      properties: Object.keys(selectedProperties).length > 0 ? selectedProperties : undefined,
    }, buttonElement);
  };

  const handleBuyNow = () => {
    if (!product || product.stock === 0 || product.tags?.includes('COMING_SOON')) return;
    handleAddToCart();
    router.push('/home/cart');
  };

  // Calculate commission percentage (example: 12.5%)
  const commissionPercentage = 12.5;
  const tokenAmount = (product?.price || 0) * 0.125;
  const soldCount = product ? getFakeSold(product.id) : 0;
  const rating = 5;

  if (loading) {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-20 bg-background text-text-main font-display antialiased">
        <div className="animate-pulse space-y-4 p-4">
          <div className="aspect-square bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-20 bg-background">
        <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 flex w-full max-w-md items-center justify-between p-4 pt-10">
          <button
            onClick={() => router.back()}
            className="relative z-10 flex size-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-gray-500 mb-4">{t("productNotFound")}</p>
            <button
              onClick={() => router.back()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              {t("back")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const orderSuccess = searchParams.get('orderSuccess') === 'true';
  const orderId = searchParams.get('orderId') || '';

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background text-text-main font-display antialiased">
      {/* Floating Back Button */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pointer-events-none">
        <button
          onClick={() => router.back()}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/30 hover:bg-black/45 text-white backdrop-blur-sm shadow-md active:scale-90 transition-all duration-150"
        >
          <span className="material-symbols-outlined text-xl font-medium">arrow_back</span>
        </button>
      </div>

      {orderSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl border border-emerald-100 flex flex-col items-center gap-4 animate-scale-up">
            <div className="size-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-4xl font-bold">check_circle</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Đặt hàng thành công!</h3>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                Đơn hàng của bạn đang được xử lý. Mã vận đơn sẽ được gửi qua số điện thoại của bạn.
                {orderId && (
                  <span className="block mt-1 font-mono font-bold text-emerald-700 text-xs bg-emerald-50 py-1 px-2 rounded-lg">
                    Mã đơn hàng: #{orderId.slice(0, 8)}...
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => {
                router.replace(`/home/products/detail?id=${productId}`);
              }}
              className="w-full bg-primary hover:bg-primary-dark text-black font-bold py-3 rounded-xl shadow-float transition-all active:scale-[0.98]"
            >
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      )}
      {/* Image Slider */}
      <div
        ref={sliderRef}
        className="relative w-full aspect-square bg-white overflow-hidden touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: "pan-x" }}
      >
        {allImages.length > 0 ? (
          <div className="relative w-full h-full">
            {/* Image Container with smooth transform */}
            <div
              className="absolute inset-0 flex"
              style={{
                transform: `translateX(calc(${-selectedImageIndex * 100}% + ${dragOffset}px))`,
                transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                willChange: isDragging ? 'transform' : 'auto',
              }}
            >
              {allImages.map((imageUrl, index) => (
                <div
                  key={index}
                  className="w-full h-full flex-shrink-0 relative bg-white"
                >
                  <img
                    src={imageUrl}
                    alt={`Product image ${index + 1}`}
                    className="w-full h-full object-cover"
                    style={{
                      imageRendering: 'auto',
                      backfaceVisibility: 'hidden',
                      transform: 'translateZ(0)',
                    } as React.CSSProperties}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                  />
                </div>
              ))}
            </div>
            {/* Image Counter */}
            {allImages.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-white/80 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm z-10">
                {selectedImageIndex + 1}/{allImages.length}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-6xl">
            📦
          </div>
        )}
        {product.stock <= 0 && !product.tags?.includes('COMING_SOON') && (
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-gray-500 text-white text-xs font-bold rounded shadow-sm z-20">
            {t("soldOut")}
          </div>
        )}
        {product.tags?.includes('SALE') && (
          <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded shadow-sm z-20">
            SALE
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="bg-white p-4 flex flex-col gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {product.salePercentage && product.salePercentage > 0 ? (
              <div className="flex flex-col">
                <span className="text-sm text-gray-400 line-through">
                  {formatVnd(product.price * usdtToVnd)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-red-600">
                    {formatVnd(product.price * (1 - product.salePercentage / 100) * usdtToVnd)}
                  </span>
                  <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded">
                    -{product.salePercentage}%
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-3xl font-bold text-primary-dark">{formatVnd(product.price * usdtToVnd)}</span>
            )}
          </div>
        </div>
        <h1 className="text-xl font-semibold leading-tight text-text-main line-clamp-2">

          {getLocalizedContent(product.name, product.nameEn)}
        </h1>
        {product.tags?.includes('COMING_SOON') && (
          <div className="mt-2">
            <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs uppercase font-bold rounded-sm">
              {lang === 'vi' ? 'Sắp ra mắt' : 'Coming Soon'}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1">
            <div className="flex text-yellow-500 gap-0.5">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="material-symbols-outlined text-base fill-current">star</span>
              ))}
            </div>
            <span className="text-sm text-text-main border-l border-gray-300 pl-1.5 ml-1.5 font-medium">{rating}</span>
            <span className="text-sm text-text-sub border-l border-gray-300 pl-1.5 ml-1.5">{t("sold")} {soldCount > 1000 ? `${(soldCount / 1000).toFixed(1)}k` : soldCount}</span>
          </div>
        </div>

        {/* Dynamic Properties Selection */}
        {product.properties && product.properties.length > 0 && (
          <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
            {product.properties.map((prop) => (
              <div key={prop.name} className="flex flex-col gap-2">
                <span className="text-sm font-medium text-text-main">{prop.name}</span>
                <div className="flex flex-wrap gap-2">
                  {prop.values.map((value) => {
                    const isSelected = selectedProperties[prop.name] === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setSelectedProperties(prev => ({ ...prev, [prop.name]: value }))}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isSelected
                          ? "bg-primary text-white shadow-md transform scale-105"
                          : "bg-gray-100 text-text-main hover:bg-gray-200"
                          }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Combo Selection */}
        {product.combos && product.combos.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4">
            <span className="text-sm font-medium text-text-main">
              {lang === 'vi' ? 'Chọn số lượng mua' : 'Purchase Option'}
            </span>
            <div className="flex flex-wrap gap-2">
              {/* Single item option */}
              <button
                onClick={() => setSelectedCombo(null)}
                className={`flex flex-col items-center px-3 py-2 rounded-lg border text-sm transition-all ${selectedCombo === null
                    ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                    : 'border-gray-200 bg-gray-50 text-text-sub hover:border-primary/40'
                  }`}
              >
                <span className="font-medium">{lang === 'vi' ? 'Đơn lẻ' : 'Single'}</span>
                <span className="text-xs mt-0.5">
                  {formatVnd(
                    (product.salePercentage && product.salePercentage > 0
                      ? product.price * (1 - product.salePercentage / 100)
                      : product.price) * usdtToVnd
                  )}
                </span>
              </button>

              {/* Combo options */}
              {product.combos.map((combo, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCombo(combo)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg border text-sm transition-all ${selectedCombo === combo
                      ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                      : 'border-gray-200 bg-gray-50 text-text-sub hover:border-primary/40'
                    }`}
                >
                  <span className="font-medium">
                    {combo.label ||
                      (lang === 'vi'
                        ? `Mua ${combo.quantity} sản phẩm`
                        : `Buy ${combo.quantity} items`)}
                  </span>
                  <span className="text-xs mt-0.5">{formatVnd(combo.price * usdtToVnd)}</span>
                  {/* Savings badge */}
                  {(() => {
                    const basePrice = product.salePercentage && product.salePercentage > 0
                      ? product.price * (1 - product.salePercentage / 100)
                      : product.price;
                    const saved = basePrice * combo.quantity - combo.price;
                    return saved > 0 ? (
                      <span className="text-[10px] mt-0.5 text-green-600 font-medium">
                        {lang === 'vi' ? 'Tiết kiệm' : 'Save'} {formatVnd(saved * usdtToVnd)}
                      </span>
                    ) : null;
                  })()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Details – only show attributes that have values */}
      <div className="mt-2 bg-white p-4 pb-24">
        <h3 className="text-sm font-medium mb-3">{t("productDetails")}</h3>
        <div className="flex flex-col gap-2">
          {((product.categoryBreadcrumb && product.categoryBreadcrumb.length > 0) || (product.category != null && product.category.name != null && product.category.name !== "")) && (
            <div className="flex text-sm">
              <span className="w-28 text-text-sub">{t("category")}</span>
              <span className="text-primary-dark">
                {product.categoryBreadcrumb && product.categoryBreadcrumb.length > 0
                  ? product.categoryBreadcrumb.join(" › ")
                  : product.category?.name}
              </span>
            </div>
          )}
          {(product.brand || product.brandEn) && (
            <div className="flex text-sm">
              <span className="w-28 text-text-sub">{t("brand")}</span>
              <span className="text-text-main">{getLocalizedContent(product.brand, product.brandEn)}</span>
            </div>
          )}
          {(product.origin || product.originEn) && (
            <div className="flex text-sm">
              <span className="w-28 text-text-sub">{t("origin")}</span>
              <span className="text-text-main">{getLocalizedContent(product.origin, product.originEn)}</span>
            </div>
          )}
          {(product.clothingType || product.clothingTypeEn) && (
            <div className="flex text-sm">
              <span className="w-28 text-text-sub">{t("clothingType")}</span>
              <span className="text-text-main">{getLocalizedContent(product.clothingType, product.clothingTypeEn)}</span>
            </div>
          )}
        </div>
        {(product.description || product.descriptionEn) && (
          <div className="mt-4">
            <div className="relative group">
              <div
                className={`text-sm text-text-sub leading-relaxed prose max-w-none ${isDescriptionExpanded ? "" : "line-clamp-[10]"
                  }`}
                dangerouslySetInnerHTML={{ __html: getLocalizedContent(product.description, product.descriptionEn) || "" }}
              />
              {!isDescriptionExpanded && (getLocalizedContent(product.description, product.descriptionEn)?.length || 0) > 500 && (
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none z-10"></div>
              )}
              {(getLocalizedContent(product.description, product.descriptionEn)?.length || 0) > 500 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="relative z-20 w-full mt-4 flex items-center justify-center gap-1 text-primary-dark text-sm font-medium py-2 border-t border-gray-50 bg-white"
                >
                  {isDescriptionExpanded ? t("collapse") : t("viewMore")}{" "}
                  <span
                    className={`material-symbols-outlined text-base transition-transform ${isDescriptionExpanded ? "rotate-180" : ""
                      }`}
                  >
                    keyboard_arrow_down
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons - Above bottom nav */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md z-[75] px-4 pb-2">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0 || !!product.tags?.includes('COMING_SOON')}
            className="flex-1 flex items-center justify-center gap-2 bg-yellow-50 text-primary-dark font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:bg-yellow-100 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
            <span className="text-sm">{t("addToCartButton")}</span>
          </button>
          <button
            onClick={handleBuyNow}
            disabled={product.stock === 0 || !!product.tags?.includes('COMING_SOON')}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:bg-primary-dark transition-colors"
          >
            <span className="material-symbols-outlined text-xl">shopping_bag</span>
            <span className="text-sm">{t("buyNowButton")}</span>
          </button>
        </div>
      </div>

      {/* Related Products */}
      {
        relatedProducts.length > 0 && (
          <div className="mt-2 bg-white p-4 pb-24">
            <h3 className="text-base font-medium mb-3">{t("relatedProducts")}</h3>
            <div className="grid grid-cols-2 gap-4">
              {relatedProducts.map((relatedProduct) => (
                <button
                  key={relatedProduct.id}
                  type="button"
                  onClick={() => router.push(`/home/products/detail?id=${relatedProduct.id}`)}
                  className="flex flex-col text-left group focus:outline-none"
                >
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 group-hover:border-primary/30 transition-colors relative">
                    <div
                      className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
                      style={{
                        backgroundImage: relatedProduct.thumbnailUrl ? `url('${relatedProduct.thumbnailUrl}')` : 'none',
                        backgroundColor: '#f5f5f5'
                      }}
                    />
                  </div>
                  <div className="mt-2">
                    <h4 className="text-xs text-text-main line-clamp-2 min-h-[2.5em]">
                      {getLocalizedContent(relatedProduct.name, relatedProduct.nameEn)}
                    </h4>
                    <div className="mt-1 flex items-baseline justify-between flex-wrap gap-1">
                      {relatedProduct.salePercentage && relatedProduct.salePercentage > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 line-through">{formatVnd(relatedProduct.price * usdtToVnd)}</span>
                          <span className="text-sm font-bold text-red-600">
                            {formatVnd(relatedProduct.price * (1 - relatedProduct.salePercentage / 100) * usdtToVnd)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-primary-dark">{formatVnd(relatedProduct.price * usdtToVnd)}</span>
                      )}
                      <span className="text-[10px] text-text-sub">{t("sold")} {getFakeSold(relatedProduct.id)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      }

      {/* Bottom Fixed Bar - Chat only */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-white border-t border-gray-100 flex h-[60px]">
        <button className="flex flex-1 flex-col items-center justify-center border-r border-gray-50 hover:bg-gray-50 transition-colors">
          <span className="material-symbols-outlined text-primary-dark text-2xl">chat_bubble_outline</span>
          <span className="text-[10px] text-text-main mt-0.5">{t("chatNow")}</span>
        </button>
        <div className="flex-[2] flex items-center justify-center text-text-sub text-xs">
          {product.stock > 0 ? (
            <span className="text-green-600 font-medium">
              {t("stockAvailable").replace("{count}", product.stock.toString())}
            </span>
          ) : (
            <span className="text-red-600 font-medium">{t("outOfStock")}</span>
          )}
        </div>
      </div>
    </div >
  );
}
