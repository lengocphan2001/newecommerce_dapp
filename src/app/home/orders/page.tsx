"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import { api } from "@/app/services/api";
import { handleAuthError } from "@/app/utils/auth";

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  thumbnailUrl?: string;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  shippingAddress?: string;
  transactionHash?: string;
  isReconsumption?: boolean;
  createdAt: string;
  updatedAt: string;
}

function OrdersPageContent() {
  const [activeTab, setActiveTab] = useState<"all" | "processing" | "delivered" | "cancelled">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    fetchOrders();
    
    // Check for success message from checkout
    const success = searchParams.get("success");
    const orderId = searchParams.get("orderId");
    if (success === "true" && orderId) {
      // Show success message (you can add a toast notification here)
    }
  }, [searchParams]);

  useEffect(() => {
    // Fetch product images for order items
    const fetchProductImages = async () => {
      const productIds = new Set<string>();
      orders.forEach(order => {
        order.items.forEach(item => {
          if (item.productId) {
            productIds.add(item.productId);
          }
        });
      });

      const images: Record<string, string> = {};
      for (const productId of Array.from(productIds)) {
        try {
          const product = await api.getProduct(productId);
          if (product.thumbnailUrl) {
            images[productId] = product.thumbnailUrl;
          }
        } catch (err) {
          // Ignore errors, use placeholder
        }
      }
      setProductImages(images);
    };

    if (orders.length > 0) {
      fetchProductImages();
    }
  }, [orders]);

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getOrders();
      // API might return array directly or wrapped in data property
      const ordersList = Array.isArray(data) ? data : (data?.data || []);
      setOrders(ordersList);
    } catch (err: any) {
      // Check if it's an authentication error and redirect
      if (handleAuthError(err, router)) {
        return; // Redirect is happening, don't set error state
      }
      setError(err.message || t("failedToLoadOrders"));
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number) => {
    return amount?.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatPriceVND = (amount: number) => {
    // Assuming 1 USDT ≈ 24,500 VND
    const vndAmount = amount * 24500;
    return vndAmount.toLocaleString("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = date.getHours() >= 12 ? "PM" : "AM";
    const hours12 = (date.getHours() % 12 || 12).toString().padStart(2, "0");
    return `${day}/${month}/${year} • ${hours12}:${minutes} ${ampm}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
      case "confirmed":
      case "processing":
      case "shipped":
        return t("orderStatusProcessing");
      case "delivered":
        return t("orderStatusDelivered");
      case "cancelled":
        return t("orderStatusCancelled");
      default:
        return status;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "pending":
      case "confirmed":
      case "processing":
      case "shipped":
        return "bg-yellow-50 text-yellow-700 ring-yellow-600/20";
      case "delivered":
        return "bg-green-50 text-green-700 ring-green-600/20";
      case "cancelled":
        return "bg-red-50 text-red-600 ring-red-600/10";
      default:
        return "bg-slate-50 text-slate-600 ring-slate-600/10";
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "pending":
        return 20;
      case "confirmed":
        return 40;
      case "processing":
        return 60;
      case "shipped":
        return 80;
      case "delivered":
        return 100;
      default:
        return 0;
    }
  };

  const getOrderImage = (order: Order): string => {
    // Get first item's image, or use placeholder
    if (order.items.length > 0) {
      const firstItem = order.items[0];
      if (firstItem.thumbnailUrl) {
        return firstItem.thumbnailUrl;
      }
      if (productImages[firstItem.productId]) {
        return productImages[firstItem.productId];
      }
    }
    // Placeholder image
    return "https://placehold.co/72x72/F3F4F6/6B7280.png?text=Order";
  };

  const calculatePV = (totalAmount: number): number => {
    // PV = totalAmount (1:1 ratio)
    return Math.round(totalAmount);
  };

  const filteredOrders =
    activeTab === "all"
      ? orders
      : activeTab === "processing"
      ? orders.filter((order) => ["pending", "confirmed", "processing", "shipped"].includes(order.status))
      : activeTab === "delivered"
      ? orders.filter((order) => order.status === "delivered")
      : orders.filter((order) => order.status === "cancelled");

  const processingCount = orders.filter((o) => 
    ["pending", "confirmed", "processing", "shipped"].includes(o.status)
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div className="flex flex-col bg-background-light min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-[0_1px_3px_rgba(37,99,235,0.05)]">
        <button 
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-blue-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("orderHistory")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/10 border border-blue-600/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">SafePal</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-blue-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      {/* SafePal Connection Banner (Mobile) */}
      <div className="sm:hidden w-full bg-blue-50/50 border-b border-blue-100 py-1.5 flex justify-center items-center gap-2 shadow-sm relative z-40">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600"></span>
        </span>
        <span className="text-[11px] text-blue-800 font-semibold">{t("connectedToSafePal")}</span>
      </div>

      {/* Tabs */}
      <div className="bg-white pt-2 sticky top-[58px] z-30 shadow-sm border-b border-blue-50">
        <div className="flex px-4 justify-between gap-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("all")}
            className={`group flex flex-col items-center justify-center min-w-[70px] pb-3 pt-2 relative ${
              activeTab === "all" ? "" : ""
            }`}
          >
            <p className={`text-sm font-bold leading-normal tracking-[0.015em] ${
              activeTab === "all" ? "text-blue-800" : "text-slate-500 group-hover:text-blue-800 transition-colors"
            }`}>{t("allOrders")}</p>
            {activeTab === "all" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-blue-600 rounded-t-sm"></div>
            )}
            {activeTab !== "all" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-transparent group-hover:bg-blue-600/50 transition-colors rounded-t-sm"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("processing")}
            className={`group flex flex-col items-center justify-center min-w-[70px] pb-3 pt-2 relative ${
              activeTab === "processing" ? "" : ""
            }`}
          >
            <p className={`text-sm font-medium leading-normal tracking-[0.015em] ${
              activeTab === "processing" ? "text-blue-800 font-bold" : "text-slate-500 group-hover:text-blue-800 transition-colors"
            }`}>{t("processingOrders")}</p>
            {activeTab === "processing" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-blue-600 rounded-t-sm"></div>
            )}
            {activeTab !== "processing" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-transparent group-hover:bg-blue-600/50 transition-colors rounded-t-sm"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("delivered")}
            className={`group flex flex-col items-center justify-center min-w-[70px] pb-3 pt-2 relative ${
              activeTab === "delivered" ? "" : ""
            }`}
          >
            <p className={`text-sm font-medium leading-normal tracking-[0.015em] ${
              activeTab === "delivered" ? "text-blue-800 font-bold" : "text-slate-500 group-hover:text-blue-800 transition-colors"
            }`}>{t("deliveredOrders")}</p>
            {activeTab === "delivered" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-blue-600 rounded-t-sm"></div>
            )}
            {activeTab !== "delivered" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-transparent group-hover:bg-blue-600/50 transition-colors rounded-t-sm"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("cancelled")}
            className={`group flex flex-col items-center justify-center min-w-[70px] pb-3 pt-2 relative ${
              activeTab === "cancelled" ? "" : ""
            }`}
          >
            <p className={`text-sm font-medium leading-normal tracking-[0.015em] ${
              activeTab === "cancelled" ? "text-blue-800 font-bold" : "text-slate-500 group-hover:text-blue-800 transition-colors"
            }`}>{t("cancelledOrders")}</p>
            {activeTab === "cancelled" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-blue-600 rounded-t-sm"></div>
            )}
            {activeTab !== "cancelled" && (
              <div className="absolute bottom-0 w-full h-[3px] bg-transparent group-hover:bg-blue-600/50 transition-colors rounded-t-sm"></div>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        {loading ? (
          <div className="flex justify-center py-2">
            <span className="material-symbols-outlined animate-spin text-blue-600">refresh</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 text-6xl">⚠️</div>
            <p className="mb-4 text-red-600">{error}</p>
            <button
              onClick={fetchOrders}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t("retry")}
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 text-6xl">📦</div>
            <p className="text-slate-500">{t("noOrders")}</p>
          </div>
        ) : (
          <>
            {filteredOrders.map((order) => {
              const isProcessing = ["pending", "confirmed", "processing", "shipped"].includes(order.status);
              const isDelivered = order.status === "delivered";
              const isCancelled = order.status === "cancelled";
              const orderImage = getOrderImage(order);
              const pvEarned = calculatePV(order.totalAmount);
              const progressPercentage = getProgressPercentage(order.status);

              return (
                <div
                  key={order.id}
                  onClick={() => router.push(`/home/orders/detail?id=${order.id}`)}
                  className={`flex flex-col gap-3 rounded-2xl p-4 shadow-[0_2px_12px_rgba(37,99,235,0.06)] border ${
                    isCancelled 
                      ? "bg-slate-50 border-slate-200 opacity-75" 
                      : "bg-white border-blue-100"
                  } active:scale-[0.99] transition-all duration-200 cursor-pointer`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 rounded-xl overflow-hidden h-[72px] w-[72px] border relative shadow-inner ${
                        isCancelled 
                          ? "bg-slate-200 border-slate-300 grayscale" 
                          : "bg-blue-50 border-blue-100"
                      }`}>
                        <div 
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url("${orderImage}")` }}
                        ></div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            isCancelled ? "text-slate-500 line-through" : "text-slate-900"
                          }`}>
                            #{order.id.slice(0, 8).toUpperCase()}
                          </span>
                          {isProcessing && (
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 ring-2 ring-white"></span>
                          )}
                        </div>
                        <p className={`text-xs font-medium ${
                          isCancelled ? "text-slate-400" : "text-slate-500"
                        }`}>
                          {formatDateTime(order.createdAt)}
                        </p>
                        
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getStatusBadgeStyle(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                      <div className="text-right mt-1">
                        <p className={`text-lg font-bold tracking-tight ${
                          isCancelled ? "text-slate-600" : "text-blue-800"
                        }`}>
                          {formatPrice(order.totalAmount)} USDT
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for Processing Orders */}
                  {isProcessing && (
                    <div className="w-full bg-blue-50 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div 
                        className="bg-yellow-500 h-1.5 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.6)] transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Rebuy Button for Delivered Orders */}
                  {isDelivered && (
                    <div className="pt-2 border-t border-blue-50 flex justify-end">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Navigate to products page or add to cart
                          router.push("/home/products");
                        }}
                        className="px-3 py-1.5 rounded-lg text-sm font-semibold text-blue-600 bg-blue-600/5 hover:bg-blue-600/10 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                          autorenew
                        </span>
                        {t("rebuyOrder")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="h-6"></div>
          </>
        )}
      </main>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col bg-background-light min-h-screen">
        <div className="flex justify-center items-center py-12">
          <span className="material-symbols-outlined animate-spin text-blue-600">refresh</span>
        </div>
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}
