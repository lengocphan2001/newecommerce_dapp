"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

interface OrderItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    thumbnailUrl?: string;
    properties?: { [key: string]: string };
}

interface Order {
    id: string;
    userId: string;
    items: OrderItem[];
    totalAmount: number;
    shippingFee?: number;
    vatRate?: number;
    vatAmount?: number;
    status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
    shippingAddress?: string;
    shippingPhone?: string;
    shippingName?: string;
    transactionHash?: string;
    paymentMethod?: string;
    createdAt: string;
    updatedAt: string;
}

export default function OrderDetailClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();
    const orderId = searchParams.get('id') as string;
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [itemsWithImages, setItemsWithImages] = useState<OrderItem[]>([]);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchOrderDetails();
        }
    }, [orderId]);

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            const data = await api.getOrder(orderId);
            setOrder(data);

            const items: OrderItem[] = data.items || [];
            const needIds = [
                ...new Set(
                    items
                        .filter((i) => !i.thumbnailUrl?.trim())
                        .map((i) => i.productId)
                        .filter(Boolean),
                ),
            ];
            let thumbMap: Record<string, string> = {};
            if (needIds.length > 0) {
                try {
                    thumbMap = await api.getProductThumbnails(needIds);
                } catch {
                    /* ignore */
                }
            }
            setItemsWithImages(
                items.map((item) =>
                    item.thumbnailUrl?.trim()
                        ? item
                        : { ...item, thumbnailUrl: thumbMap[item.productId] },
                ),
            );

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
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        }).format(price);
    };

    const formatPriceVND = (amount: number) => {
        const vndAmount = amount * 25000;
        return `${vndAmount.toLocaleString("vi-VN")} VND`;
    };

    const copyToClipboard = async (text: string, e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand("copy");
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (fallbackErr) {
                console.error("Failed to copy:", fallbackErr);
            }
            document.body.removeChild(textArea);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    const getStatusText = (status: string) => {
        switch (status) {
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
        switch (status) {
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
            <div className="min-h-screen flex items-center justify-center bg-emerald-50">
                <span className="material-symbols-outlined animate-spin text-primary-dark text-3xl">refresh</span>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-emerald-50 p-4">
                <p className="text-slate-600 font-medium mb-4">{t("noOrders")}</p>
                <button onClick={() => router.back()} className="text-primary-dark font-bold">{t("back")}</button>
            </div>
        );
    }

    const currentStep = getStatusStep(order.status);
    const isCancelled = order.status === 'cancelled';
    const pvEarned = Math.round(order.totalAmount); // Simulated PV

    return (
        <div className="bg-gray-50 font-display text-slate-900 antialiased min-h-screen flex flex-col pb-24">
            {/* Header */}
            <div className="sticky top-0 z-50 flex items-center bg-white/90 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-100">
                <button
                    onClick={() => router.back()}
                    className="text-slate-900 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">
                    {t("orderDetails")}
                </h2>
            </div>

            <div className="flex-1 px-4 pt-4 flex flex-col gap-5">

                {/* Status Card */}
                <div className="relative group overflow-hidden premium-card bg-white">
                    {/* Background Image Overlay */}
                    <div className="absolute inset-0 opacity-10 bg-center bg-cover grayscale" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDAH9U60gKAgxWRKdFBYLD-BwpafTxxP6cTE3FPgJ_avx6WK-jGQwhYtkwW1GGQq2ljz4VF50AxQB12uwKbxq7fIfLP4-Npdo2kiFrYDV0EeYgGBTIU5zWjRfqOnJqhb92Piq_1O3j1Et6Kl6LENcT6SLtnl9OJtyQ0mWWW-J5GpojX7_zqETwLBy4m8y1JqFVpujsjxOQXKuO0926RjddxvM3cThQUB1oGS9bKEbvgUlGpek7QKHMnRqQcEZgnIpJXozsOiQ0W0sE")' }}></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/80 to-white"></div>

                    <div className="relative p-5 z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <p className="text-primary-dark font-bold text-xs uppercase tracking-wider mb-1">{t("orderStatus")}</p>
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
                        </div>

                        {!isCancelled && (
                            <div className="flex items-center justify-between w-full relative px-2">
                                {/* Background Line */}
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-emerald-50 -translate-y-1/2 z-0 rounded-full"></div>
                                {/* Active Line */}
                                <div
                                    className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 shadow-sm rounded-full transition-all duration-500"
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
                                            <div className={`rounded-full ring-4 ring-white shadow-sm flex items-center justify-center transition-all duration-300 ${isCurrent ? "size-8 bg-primary shadow-emerald-200 shadow-md" :
                                                isActive ? "size-4 bg-primary" :
                                                    "size-4 bg-slate-200"
                                                }`}>
                                                {isCurrent && (
                                                    <span className="material-symbols-outlined text-[16px] text-white font-bold">
                                                        {s.step === 3 ? "home" : "local_shipping"}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[11px] font-semibold absolute -bottom-7 w-max ${isCurrent ? "text-primary-dark bg-emerald-50/90 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-emerald-100" :
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

                {/* Product List */}
                <div>
                    <h3 className="text-slate-800 text-lg font-bold mb-3 px-1">{t("productList")}</h3>
                    <div className="flex flex-col gap-3">
                        {itemsWithImages.map((item, idx) => (
                            <div key={idx} className="flex gap-4 p-3 items-center premium-card bg-white">
                                <div
                                    className="bg-center bg-no-repeat bg-cover rounded-xl size-[80px] shrink-0 bg-slate-50 border border-slate-100"
                                    style={{ backgroundImage: `url("${item.thumbnailUrl || 'https://placehold.co/80x80/F3F4F6/6B7280.png?text=Product'}")` }}
                                ></div>
                                <div className="flex flex-1 flex-col justify-center gap-1">
                                    <p className="text-slate-900 text-base font-bold leading-tight">{item.productName}</p>
                                    {item.properties && Object.keys(item.properties).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {Object.entries(item.properties).map(([key, value]) => (
                                                <span key={key} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                                    {key}: {value}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-primary-dark text-sm font-bold">{formatPriceVND(item.price)}</span>
                                    </div>
                                </div>
                                <div className="shrink-0 size-9 flex items-center justify-center bg-emerald-50 rounded-lg border border-emerald-100 text-primary-dark">
                                    <p className="text-sm font-bold">x{item.quantity}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shipping & Payment Info */}
                <div className="p-5 space-y-5 premium-card bg-white">
                    <h3 className="text-slate-900 font-bold text-base border-b border-slate-100 pb-2">{t("shippingPaymentInfo")}</h3>

                    <div className="flex items-start gap-4">
                        <div className="mt-0.5 size-10 rounded-full bg-emerald-50 text-primary-dark flex items-center justify-center shrink-0 border border-emerald-100">
                            <span className="material-symbols-outlined text-xl">location_on</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{t("deliveryAddress")}</p>
                            {(order.shippingName || order.shippingPhone) && (
                                <p className="text-slate-900 text-sm font-medium leading-relaxed mb-1">
                                    {[order.shippingName, order.shippingPhone].filter(Boolean).join(" · ")}
                                </p>
                            )}
                            <p className="text-slate-900 text-sm font-medium leading-relaxed">{order.shippingAddress || "N/A"}</p>
                        </div>
                    </div>

                    <div className="h-px bg-slate-50 w-full"></div>

                    <div className="flex items-start gap-4">
                        <div className="mt-0.5 size-10 rounded-full bg-emerald-50 text-primary-dark flex items-center justify-center shrink-0 border border-emerald-100">
                            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wide mb-1">{t("paymentMethodSafePal")}</p>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                {order.paymentMethod === "deposit_wallet" && (
                                    <>
                                        <span className="text-slate-900 text-sm font-bold">Ví tiêu dùng</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200 font-bold">Đã trừ ví</span>
                                    </>
                                )}
                                {order.paymentMethod === "pv_wallet" && (
                                    <>
                                        <span className="text-slate-900 text-sm font-bold">Ví nạp PV</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200 font-bold">Đã trừ ví</span>
                                    </>
                                )}
                                {order.paymentMethod === "banking" && (
                                    <span className="text-slate-900 text-sm font-bold">Chuyển khoản ngân hàng</span>
                                )}
                                {order.paymentMethod === "usdt" && (
                                    <>
                                        <span className="text-slate-900 text-sm font-bold">Chuyển USDT thủ công</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">Chờ duyệt</span>
                                    </>
                                )}
                                {order.paymentMethod !== "deposit_wallet" && order.paymentMethod !== "banking" && order.paymentMethod !== "usdt" && (
                                    <>
                                        <span className="text-slate-900 text-sm font-bold">Shoplife Wallet (USDT)</span>
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">BEP20</span>
                                    </>
                                )}
                            </div>
                            {order.transactionHash && (
                                <div
                                    onClick={(e) => copyToClipboard(order.transactionHash!, e)}
                                    className="flex items-center gap-2 cursor-pointer group/hash w-fit bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 hover:border-yellow-300 transition-colors"
                                >
                                    <p className="text-slate-500 text-[11px] font-mono group-hover/hash:text-primary-dark transition-colors truncate max-w-[200px] font-medium">
                                        {order.transactionHash.slice(0, 6) + "..." + order.transactionHash.slice(-4)}
                                    </p>
                                    <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover/hash:text-primary-dark">
                                        {copied ? "check" : "content_copy"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-px bg-slate-50 w-full"></div>

                    <div className="flex items-start gap-4">
                        <div className="mt-0.5 size-10 rounded-full bg-emerald-50 text-primary-dark flex items-center justify-center shrink-0 border border-emerald-100">
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
                <div className="p-5 space-y-3 mb-4 premium-card bg-white">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">{t("subtotal")}</span>
                        <span className="text-slate-900 font-medium">{formatPriceVND(order.totalAmount - (order.shippingFee || 0) - (order.vatAmount || 0))}</span>
                    </div>
                    {(order.shippingFee || 0) > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">{t("shippingFee")}</span>
                            <span className="text-slate-900 font-medium">{formatPriceVND(order.shippingFee || 0)}</span>
                        </div>
                    )}
                    {(order.vatAmount || 0) > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">{t("vat")} ({order.vatRate || 8}%)</span>
                            <span className="text-slate-900 font-medium">{formatPriceVND(order.vatAmount || 0)}</span>
                        </div>
                    )}

                    <div className="h-px bg-slate-100 w-full my-2 border-dashed border-b border-slate-200"></div>

                    <div className="flex justify-between items-center">
                        <span className="text-slate-900 font-bold text-base">{t("total")}</span>
                        <div className="text-right">
                            <span className="text-primary-dark font-bold text-xl block">{formatPriceVND(order.totalAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="pb-8 flex gap-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
                    <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3.5 px-4 text-slate-900 hover:bg-slate-100 transition-colors font-semibold border border-slate-200">
                        <span className="material-symbols-outlined text-[20px]">support_agent</span>
                        {t("support")}
                    </button>
                    <button
                        onClick={() => router.push('/home/products')}
                        className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 px-4 text-white hover:bg-primary-dark transition-colors font-bold shadow-lg shadow-emerald-200"
                    >
                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                        {t("rebuyOrder")}
                    </button>
                </div>

            </div>
        </div>
    );
}
