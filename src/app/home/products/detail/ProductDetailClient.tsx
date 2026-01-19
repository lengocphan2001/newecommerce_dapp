"use client";

import React, { useEffect, useState } from "react";
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
  description?: string;
  price: number;
  stock: number;
  shippingFee?: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  categoryId?: string;
  category?: Category;
  countries?: ('VIETNAM' | 'USA')[];
  createdAt: string;
  soldCount?: number;
}

export default function ProductDetailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const productId = searchParams.get('id') as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const { addItem, totalItems } = useShoppingCart();

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

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
    setTouchStart(e.targetTouches[0].clientX);
    setDragOffset(0);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || allImages.length <= 1) return;
    e.preventDefault();
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
      
      // Fetch related products
      try {
        const allProducts = await api.getProducts();
        const productsList = Array.isArray(allProducts) ? allProducts : (allProducts?.data || []);
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(price);
  };

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (!product || product.stock === 0) return;
    const buttonElement = e?.currentTarget as HTMLElement;
    addItem({
      productId: product.id,
      productName: product.name,
      price: product.price,
      thumbnailUrl: product.thumbnailUrl,
    }, buttonElement);
  };

  const handleBuyNow = () => {
    if (!product || product.stock === 0) return;
    handleAddToCart();
    router.push('/home/cart');
  };

  // Calculate commission percentage (example: 12.5%)
  const commissionPercentage = 12.5;
  const tokenAmount = (product?.price || 0) * 0.125;
  const soldCount = product?.soldCount || 0;
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
        <div className="fixed top-0 z-50 flex w-full items-center justify-between p-4 pt-10">
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

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background text-text-main font-display antialiased">
      {/* Image Slider */}
      <div 
        className="relative w-full aspect-square bg-white overflow-hidden touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-x' }}
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
                      WebkitImageRendering: 'auto',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'translateZ(0)',
                      WebkitTransform: 'translateZ(0)',
                    }}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                  />
                </div>
              ))}
            </div>
            {/* Navigation Dots */}
            {allImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {allImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === selectedImageIndex
                        ? 'w-6 bg-white'
                        : 'w-2 bg-white/50 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            )}
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
      </div>

      {/* Product Info */}
      <div className="bg-white p-4 flex flex-col gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-orange-600">${formatPrice(product.price)}</span>
          </div>
          
        </div>
        <h1 className="text-xl font-semibold leading-tight text-text-main line-clamp-2">
          <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded mr-2 align-middle font-bold">{t("favorite")}</span>
          {product.name}
        </h1>
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
      </div>

      {/* Product Details */}
      <div className="mt-2 bg-white p-4 pb-24">
        <h3 className="text-sm font-medium mb-3">{t("productDetails")}</h3>
        <div className="flex flex-col gap-2">
          {product.category && (
            <div className="flex text-sm">
              <span className="w-28 text-text-sub">{t("category")}</span>
              <span className="text-blue-600">{product.category.name}</span>
            </div>
          )}
          <div className="flex text-sm">
            <span className="w-28 text-text-sub">{t("brand")}</span>
            <span className="text-text-main">SafePalMall</span>
          </div>
        </div>
        {product.description && (
          <div className="mt-4">
            <div className="relative group">
              <div
                className={`text-sm text-text-sub leading-relaxed prose max-w-none ${
                  isDescriptionExpanded ? "" : "line-clamp-[10]"
                }`}
                dangerouslySetInnerHTML={{ __html: product.description || "" }}
              />
              {!isDescriptionExpanded && (product.description?.length || 0) > 500 && (
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none z-10"></div>
              )}
              {(product.description?.length || 0) > 500 && (
                <button
                  onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  className="relative z-20 w-full mt-4 flex items-center justify-center gap-1 text-orange-600 text-sm font-medium py-2 border-t border-gray-50 bg-white"
                >
                  {isDescriptionExpanded ? t("collapse") : t("viewMore")}{" "}
                  <span
                    className={`material-symbols-outlined text-base transition-transform ${
                      isDescriptionExpanded ? "rotate-180" : ""
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
      <div className="fixed bottom-24 left-0 right-0 z-[75] px-4 pb-2">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-50 text-orange-600 font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:bg-orange-100 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
            <span className="text-sm">{t("addToCartButton")}</span>
          </button>
          <button
            onClick={handleBuyNow}
            disabled={product.stock === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:bg-orange-700 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">shopping_bag</span>
            <span className="text-sm">{t("buyNowButton")}</span>
          </button>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-2 bg-white p-4 pb-24">
          <h3 className="text-base font-medium mb-3">{t("relatedProducts")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {relatedProducts.map((relatedProduct) => (
              <button
                key={relatedProduct.id}
                onClick={() => router.push(`/home/products/detail?id=${relatedProduct.id}`)}
                className="bg-white border border-gray-100 flex flex-col text-left"
              >
                <div className="aspect-square w-full bg-cover bg-center" style={{
                  backgroundImage: relatedProduct.thumbnailUrl ? `url('${relatedProduct.thumbnailUrl}')` : 'none',
                  backgroundColor: '#f5f5f5'
                }}></div>
                <div className="p-2 flex flex-col gap-1">
                  <span className="text-xs text-text-main line-clamp-2">{relatedProduct.name}</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-orange-600">${formatPrice(relatedProduct.price)}</span>
                    <span className="text-[10px] text-text-sub">{t("sold")} {relatedProduct.soldCount || 0}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Fixed Bar - Chat only */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex h-[60px]">
        <button className="flex flex-1 flex-col items-center justify-center border-r border-gray-50 hover:bg-gray-50 transition-colors">
          <span className="material-symbols-outlined text-orange-600 text-2xl">chat_bubble_outline</span>
          <span className="text-[10px] text-text-main mt-0.5">{t("chatNow")}</span>
        </button>
        <div className="flex-[2] flex items-center justify-center text-text-sub text-xs">
          {product.stock > 0 ? (
            <span className="text-green-600 font-medium">{t("stockAvailable")}</span>
          ) : (
            <span className="text-red-600 font-medium">{t("outOfStock")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
