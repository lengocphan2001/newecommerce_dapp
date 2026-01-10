"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function ProductDetailClient() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [isSliderPaused, setIsSliderPaused] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const { addItem, totalItems } = useShoppingCart();

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setHeaderScrolled(scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const handleAddToCart = () => {
    if (!product || product.stock === 0) return;

    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        productName: product.name,
        price: product.price,
        thumbnailUrl: product.thumbnailUrl,
      });
    }

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const allImages = product
    ? [
        product.thumbnailUrl,
        ...(product.detailImageUrls || []),
      ].filter(Boolean) as string[]
    : [];

  // Auto-play slider
  useEffect(() => {
    if (allImages.length <= 1 || isSliderPaused) return;

    const interval = setInterval(() => {
      setSelectedImageIndex((prev) => (prev + 1) % allImages.length);
    }, 4000); // Change image every 4 seconds

    return () => clearInterval(interval);
  }, [allImages.length, isSliderPaused]);

  // Calculate commission percentage (example: 12.5%)
  const commissionPercentage = 12.5;
  const tokenAmount = (product?.price || 0) * 0.125;
  // Calculate sold percentage (assuming total stock was 100, adjust as needed)
  const totalStock = product ? product.stock + 86 : 100; // Example: if 15 left, 86 sold = 101 total
  const soldPercentage = product && totalStock > 0 
    ? Math.min(100, Math.round(((totalStock - product.stock) / totalStock) * 100)) 
    : 86; // Default to 86% if calculation fails

  if (loading) {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background-gray">
        <div className="animate-pulse space-y-4 p-4">
          <div className="aspect-[4/5] bg-gray-200 rounded-b-[2.5rem]"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background">
        <div className="fixed top-0 z-50 flex w-full items-center justify-between p-4 pt-12 lg:pt-4">
          <button
            onClick={() => router.back()}
            className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm hover:bg-white active:scale-95 transition-all text-gray-900"
          >
            <span className="material-symbols-outlined">arrow_back</span>
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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background-gray text-gray-900 font-display antialiased">
      {/* Custom Header with Scroll Effect */}
      <div
        className={`fixed top-0 z-50 flex w-full items-center justify-between p-4 pt-12 lg:pt-4 transition-all duration-300`}
        id="top-bar"
      >
        <div
          className={`absolute inset-0 bg-white/90 backdrop-blur-md transition-opacity duration-300 shadow-sm ${
            headerScrolled ? "opacity-100" : "opacity-0"
          }`}
          id="top-bar-bg"
        ></div>
        <button
          onClick={() => router.back()}
          className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm hover:bg-white active:scale-95 transition-all text-gray-900"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2
          className={`relative z-10 text-gray-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center truncate px-4 transition-opacity duration-300 ${
            headerScrolled ? "opacity-100" : "opacity-0"
          }`}
          id="header-title"
        >
          {product.name}
        </h2>
        <div className="relative z-10 flex items-center gap-2">
          <button className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm hover:bg-white active:scale-95 transition-all text-text-main">
            <span className="material-symbols-outlined">share</span>
          </button>
          <button
            onClick={() => router.push("/home/cart")}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm hover:bg-white active:scale-95 transition-all text-text-main"
          >
            <span className="material-symbols-outlined">shopping_cart</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Image Gallery */}
      <div
        className="relative w-full aspect-[4/5] bg-gray-100 group overflow-hidden rounded-b-[2.5rem] shadow-md z-0"
        onMouseEnter={() => setIsSliderPaused(true)}
        onMouseLeave={() => setIsSliderPaused(false)}
        onTouchStart={() => setIsSliderPaused(true)}
        onTouchEnd={() => {
          setTimeout(() => setIsSliderPaused(false), 2000);
        }}
      >
        {allImages.length > 0 ? (
          <div
            className="w-full h-full bg-center bg-cover transition-all duration-500 ease-in-out scale-105"
            style={{ backgroundImage: `url('${allImages[selectedImageIndex]}')` }}
          ></div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-6xl">
            📦
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/30 to-transparent"></div>
        
        {/* Image Dots Indicator */}
        {allImages.length > 1 && (
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2 p-1.5 rounded-full bg-black/20 backdrop-blur-md">
            {allImages.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setSelectedImageIndex(index);
                  setIsSliderPaused(true);
                  setTimeout(() => setIsSliderPaused(false), 3000);
                }}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${
                  selectedImageIndex === index
                    ? "bg-white shadow-sm w-6"
                    : "bg-white/50 hover:bg-white/80"
                }`}
              ></button>
            ))}
          </div>
        )}
      </div>

      {/* Product Info Card */}
      <div className="flex flex-col gap-8 px-5 py-6 -mt-6 relative z-10">
        <div className="flex flex-col gap-4 bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-blue-50 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ring-1 ring-blue-100">
                  {t("organic")}
                </span>
                <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ring-1 ring-orange-100">
                  {t("bestSeller")}
                </span>
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-gray-900">
                {product.name}
              </h1>
            </div>
            <button className="group flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 hover:bg-red-50 active:scale-95 transition-all">
              <span
                className="material-symbols-outlined text-blue-300 group-hover:text-red-500 group-active:text-red-500 transition-colors"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                favorite
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-3 border-t border-dashed border-gray-200 pt-4">
            <div className="flex flex-wrap items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-primary">
                  ${formatPrice(product.price)}
                </span>
              </div>
            </div>

            {/* Stock Progress */}
            {product.stock > 0 && (
              <div className="flex flex-col gap-1.5 bg-slate-50 rounded-lg p-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-orange-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">timelapse</span>
                    {t("lowStock").replace("{count}", product.stock.toString())}
                  </span>
                  <span className="text-gray-600">
                    {t("soldPercentage").replace("{percentage}", soldPercentage.toString())}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 shadow-sm"
                    style={{ width: `${soldPercentage}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-2xl bg-blue-50/50 p-4 border border-blue-100">
            <span className="material-symbols-outlined text-2xl text-primary mb-1">
              trending_up
            </span>
            <p className="text-sm font-bold text-gray-900">{t("highCommission")}</p>
            <p className="text-xs text-gray-500">
              {t("highCommissionDesc").replace("{percentage}", commissionPercentage.toString())}
            </p>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl bg-gray-50 p-4 border border-gray-200">
            <span className="material-symbols-outlined text-2xl text-blue-500 mb-1">
              local_shipping
            </span>
            <p className="text-sm font-bold text-gray-900">{t("fastDelivery")}</p>
            <p className="text-xs text-gray-500">
              {t("fastDeliveryDesc").replace("{amount}", "20")}
            </p>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-l-4 border-primary pl-3">
              {t("productDescription")}
            </h3>
            <div className="relative group bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p
                className={`text-base leading-relaxed text-gray-500 text-justify ${
                  isDescriptionExpanded ? "" : "line-clamp-4"
                }`}
              >
                {product.description}
              </p>
              {!isDescriptionExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
              )}
              <button
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="absolute bottom-2 right-2 text-sm font-bold text-primary hover:text-primary-dark flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg"
              >
                {t("viewDetails")}{" "}
                <span
                  className={`material-symbols-outlined text-sm transition-transform ${
                    isDescriptionExpanded ? "rotate-180" : ""
                  }`}
                >
                  keyboard_arrow_down
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
            <h3 className="text-lg font-bold text-text-main border-l-4 border-primary pl-3">
              {t("relatedProducts")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {relatedProducts.map((relatedProduct) => (
                <button
                  key={relatedProduct.id}
                  onClick={() => router.push(`/home/products/${relatedProduct.id}`)}
                  className="flex flex-col gap-2 bg-white rounded-xl shadow-soft p-3 border border-gray-100 active:scale-[0.98] transition-transform text-left"
                >
                  <div className="aspect-square w-full rounded-lg bg-gray-100 overflow-hidden">
                    {relatedProduct.thumbnailUrl ? (
                      <img
                        src={relatedProduct.thumbnailUrl}
                        alt={relatedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        📦
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {relatedProduct.name}
                    </h4>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">
                        ${formatPrice(relatedProduct.price)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-4">
            <div className="flex h-14 shrink-0 items-center rounded-2xl bg-gray-50 border border-gray-200 px-2 shadow-inner">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="flex size-10 items-center justify-center rounded-xl text-gray-500 hover:bg-white hover:shadow-sm transition-all active:scale-90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">remove</span>
              </button>
              <span className="w-10 text-center text-lg font-bold text-gray-900">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                disabled={quantity >= product.stock}
                className="flex size-10 items-center justify-center rounded-xl text-gray-900 hover:bg-white hover:shadow-sm transition-all active:scale-90 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">add</span>
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className="flex h-14 flex-1 items-center justify-between rounded-2xl bg-primary px-6 font-bold text-white shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all hover:bg-primary-dark group overflow-hidden relative disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="flex items-center gap-2 relative z-10">
                <span className="material-symbols-outlined">shopping_cart</span>
                {t("addToCart")}
              </span>
              <span className="relative z-10 text-lg">${formatPrice(product.price * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 z-[120] -translate-x-1/2 transform">
          <div className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {t("addedToCart").replace("{quantity}", quantity.toString())}
          </div>
        </div>
      )}
    </div>
  );
}
