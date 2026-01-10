"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
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
  createdAt: string;
  updatedAt: string;
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { t } = useI18n();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsWithImages, setItemsWithImages] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const data = await api.getOrder(orderId);
      setOrder(data);
      
      // Fetch product images if needed or if missing
      // Assuming api.getProduct is available to get standard images if thumbnail missing
      // For now, we use what's in order items or placeholders
      const updatedItems = await Promise.all(
         (data.items || []).map(async (item: OrderItem) => {
             if (item.thumbnailUrl) return item;
             try {
                 const product = await api.getProduct(item.productId);
                 return { ...item, thumbnailUrl: product.thumbnailUrl };
             } catch {
                 return item;
             }
         })
      );
      setItemsWithImages(updatedItems);

    } catch (error: any) {
      // Check if it's an authentication error and redirect
      if (handleAuthError(error, router)) {
        return; // Redirect is happening
      }
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', { 
          day: '2-digit', month: '2-digit', year: 'numeric', 
          hour: '2-digit', minute: '2-digit', hour12: true 
      });
  };

  const getStatusText = (status: string) => {
     switch(status) {
         case 'pending': return t("orderStatusProcessing");
         case 'confirmed': return t("orderStatusConfirmed");
         case 'processing': return t("orderStatusProcessing");
         case 'shipped': return t("orderStatusShipped");
         case 'delivered': return t("orderStatusDelivered");
         case 'cancelled': return t("orderStatusCancelled");
         default: return status;
     }
  };

  const getStatusStep = (status: string) => {
      // 0: Placed, 1: Confirmed, 2: Shipping, 3: Delivered
      switch(status) {
          case 'pending': return 0;
          case 'confirmed': return 1;
          case 'processing': return 1; 
          case 'shipped': return 2;
          case 'delivered': return 3;
          case 'cancelled': return -1;
          default: return 0;
      }
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-blue-50">
              <span className="material-symbols-outlined animate-spin text-blue-600 text-3xl">refresh</span>
          </div>
      );
  }

  if (!order) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 p-4">
             <p className="text-slate-600 font-medium mb-4">{t("noOrders")}</p>
             <button onClick={() => router.back()} className="text-blue-600 font-bold">{t("back")}</button>
        </div>
      );
  }

  const currentStep = getStatusStep(order.status);
  const isCancelled = order.status === 'cancelled';
  const pvEarned = Math.round(order.totalAmount); // Simulated PV

  return (
    <div className="bg-[#eff6ff] font-display text-slate-900 antialiased min-h-screen flex flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 flex items-center bg-white/90 backdrop-blur-md p-4 pb-2 justify-between border-b border-blue-100">
        <button 
           onClick={() => router.back()}
           className="text-slate-900 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-blue-50 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
            {t("orderDetails")}
        </h2>
      </div>

      <div className="flex-1 px-4 pt-4 flex flex-col gap-5">
        
        {/* Status Card */}
        <div className="rounded-2xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(37,99,235,0.08)] bg-white relative group border border-blue-100">
           {/* Background Image Overlay */}
           <div className="absolute inset-0 opacity-10 bg-center bg-cover grayscale" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDAH9U60gKAgxWRKdFBYLD-BwpafTxxP6cTE3FPgJ_avx6WK-jGQwhYtkwW1GGQq2ljz4VF50AxQB12uwKbxq7fIfLP4-Npdo2kiFrYDV0EeYgGBTIU5zWjRfqOnJqhb92Piq_1O3j1Et6Kl6LENcT6SLtnl9OJtyQ0mWWW-J5GpojX7_zqETwLBy4m8y1JqFVpujsjxOQXKuO0926RjddxvM3cThQUB1oGS9bKEbvgUlGpek7QKHMnRqQcEZgnIpJXozsOiQ0W0sE")'}}></div>
           <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/80 to-white"></div>
           
           <div className="relative p-5 z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                   <p className="text-[#2563eb] font-bold text-xs uppercase tracking-wider mb-1">{t("orderStatus")}</p>
                   <h3 className={`text-slate-900 text-2xl font-bold ${isCancelled ? "text-red-500" : ""}`}>
                       {getStatusText(order.status)}
                   </h3>
                   {!isCancelled && (
                       <p className="text-slate-500 text-sm mt-1 flex items-center gap-1 font-medium">
                           <span className="material-symbols-outlined text-[16px]">schedule</span>
                           {t("lastUpdated")} {formatDate(order.updatedAt)}
                       </p>
                   )}
                </div>
                <div className={`p-3 rounded-xl shadow-sm border ${isCancelled ? "bg-red-50 text-red-500 border-red-100" : "bg-blue-50 text-[#2563eb] border-blue-100"}`}>
                   <span className="material-symbols-outlined text-2xl">
                       {isCancelled ? "cancel" : order.status === 'delivered' ? "check_circle" : "local_shipping"}
                   </span>
                </div>
              </div>

              {!isCancelled && (
                  <div className="flex items-center justify-between w-full relative px-2">
                    {/* Background Line */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-blue-50 -translate-y-1/2 z-0 rounded-full"></div>
                    {/* Active Line */}
                    <div 
                        className="absolute top-1/2 left-0 h-1 bg-[#2563eb] -translate-y-1/2 z-0 shadow-sm rounded-full transition-all duration-500"
                        style={{ width: `${(currentStep / 3) * 100}%` }}
                    ></div>

                    {/* Steps */}
                    {[
                        { label: t("orderPlaced"), step: 0 },
                        { label: t("orderConfirmed"), step: 1 },
                        { label: t("orderShipping"), step: 2 },
                        { label: t("orderStatusDelivered"), step: 3 }
                    ].map((s, idx) => {
                        const isActive = currentStep >= s.step;
                        const isCurrent = currentStep === s.step;
                        
                        return (
                            <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={`rounded-full ring-4 ring-white shadow-sm flex items-center justify-center transition-all duration-300 ${
                                    isCurrent ? "size-8 bg-[#2563eb] shadow-blue-200 shadow-md" : 
                                    isActive ? "size-4 bg-[#2563eb]" : 
                                    "size-4 bg-slate-200"
                                }`}>
                                    {isCurrent && (
                                        <span className="material-symbols-outlined text-[16px] text-white font-bold">
                                            {s.step === 3 ? "home" : "local_shipping"}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[11px] font-semibold absolute -bottom-7 w-max ${
                                    isCurrent ? "text-[#1d4ed8] bg-blue-50/90 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-blue-100" : 
                                    isActive ? "text-slate-900" : "text-slate-400 font-medium"
                                }`}>
                                    {s.label}
                                </span>
                            </div>
                        )
                    })}
                  </div>
              )}
              <div className="h-6"></div>
           </div>
        </div>

        {/* PV Bonus Card */}
        {!isCancelled && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-200 text-white border border-blue-500">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm text-white border border-white/20 shadow-sm">
                   <span className="material-symbols-outlined block">hub</span>
                </div>
                <div className="flex-1">
                   <p className="text-white text-sm font-bold">{t("binaryCommission")}</p>
                   <p className="text-blue-50 text-xs mt-0.5">Bạn nhận được <span className="text-white font-bold">+{pvEarned} PV</span> vào nhánh phải.</p>
                </div>
            </div>
        )}

        {/* Product List */}
        <div>
           <h3 className="text-slate-800 text-lg font-bold mb-3 px-1">{t("productList")}</h3>
           <div className="flex flex-col gap-3">
              {itemsWithImages.map((item, idx) => (
                  <div key={idx} className="flex gap-4 bg-white p-3 rounded-2xl items-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-blue-100 hover:border-[#2563eb] transition-colors hover:shadow-md hover:shadow-blue-50">
                    <div 
                        className="bg-center bg-no-repeat bg-cover rounded-xl size-[80px] shrink-0 bg-slate-50 border border-slate-100"
                        style={{backgroundImage: `url("${item.thumbnailUrl || 'https://placehold.co/80x80/F3F4F6/6B7280.png?text=Product'}")`}}
                    ></div>
                    <div className="flex flex-1 flex-col justify-center gap-1">
                        <p className="text-slate-900 text-base font-bold leading-tight">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[#1d4ed8] text-sm font-bold">{formatPrice(item.price)} USDT</span>
                        </div>
                    </div>
                    <div className="shrink-0 size-9 flex items-center justify-center bg-blue-50 rounded-lg border border-blue-100 text-[#2563eb]">
                        <p className="text-sm font-bold">x{item.quantity}</p>
                    </div>
                  </div>
              ))}
           </div>
        </div>

        {/* Shipping & Payment Info */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-blue-100 space-y-5">
            <h3 className="text-slate-900 font-bold text-base border-b border-slate-100 pb-2">{t("shippingPaymentInfo")}</h3>
            
            <div className="flex items-start gap-4">
                <div className="mt-0.5 size-10 rounded-full bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="material-symbols-outlined text-xl">location_on</span>
                </div>
                <div className="flex-1">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{t("deliveryAddress")}</p>
                    <p className="text-slate-900 text-sm font-medium leading-relaxed">{order.shippingAddress || "N/A"}</p>
                </div>
            </div>
            
            <div className="h-px bg-slate-50 w-full"></div>
            
            <div className="flex items-start gap-4">
                <div className="mt-0.5 size-10 rounded-full bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                </div>
                <div className="flex-1">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{t("paymentMethodSafePal")}</p>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-slate-900 text-sm font-bold">SafePal Wallet (USDT)</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold">BEP20</span>
                    </div>
                    {order.transactionHash && (
                        <div className="flex items-center gap-2 cursor-pointer group/hash w-fit bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 hover:border-blue-300 transition-colors">
                            <p className="text-slate-500 text-[11px] font-mono group-hover/hash:text-[#2563eb] transition-colors truncate max-w-[200px] font-medium">
                                {order.transactionHash.slice(0, 6) + "..." + order.transactionHash.slice(-4)}
                            </p>
                            <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover/hash:text-[#2563eb]">content_copy</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-px bg-slate-50 w-full"></div>

            <div className="flex items-start gap-4">
                <div className="mt-0.5 size-10 rounded-full bg-blue-50 text-[#2563eb] flex items-center justify-center shrink-0 border border-blue-100">
                    <span className="material-symbols-outlined text-xl">receipt_long</span>
                </div>
                <div className="flex-1">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{t("orderCode")}</p>
                    <div className="flex flex-col gap-0.5">
                        <p className="text-slate-900 text-sm font-bold font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-slate-400 text-[11px] font-medium">{formatDate(order.createdAt)}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-blue-100 space-y-3 mb-4">
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t("subtotal")}</span>
                <span className="text-slate-900 font-medium">{formatPrice(order.totalAmount)} USDT</span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t("shippingFee")}</span>
                <span className="text-slate-900 font-medium">0.00 USDT</span>
            </div>
            
            <div className="h-px bg-slate-100 w-full my-2 border-dashed border-b border-slate-200"></div>
            
            <div className="flex justify-between items-center">
                <span className="text-slate-900 font-bold text-base">{t("total")}</span>
                <div className="text-right">
                    <span className="text-[#1d4ed8] font-bold text-xl block">{formatPrice(order.totalAmount)} USDT</span>
                </div>
            </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-blue-100 p-4 pb-8 flex gap-3 z-40 shadow-[0_-5px_20px_-5px_rgba(37,99,235,0.1)]">
        <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3.5 px-4 text-slate-900 hover:bg-slate-100 transition-colors font-semibold border border-slate-200">
            <span className="material-symbols-outlined text-[20px]">support_agent</span>
            {t("support")}
        </button>
        <button 
            onClick={() => router.push('/home/products')}
            className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] py-3.5 px-4 text-white hover:bg-[#1d4ed8] transition-colors font-bold shadow-lg shadow-blue-200"
        >
            <span className="material-symbols-outlined text-[20px]">refresh</span>
            {t("rebuyOrder")}
        </button>
      </div>
    </div>
  );
}
