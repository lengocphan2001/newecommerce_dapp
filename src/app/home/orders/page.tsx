"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/app/i18n/I18nProvider";
import { api } from "@/app/services/api";

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
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

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    fetchOrders();
    
    // Check for success message from checkout
    const success = searchParams.get("success");
    const orderId = searchParams.get("orderId");
    if (success === "true" && orderId) {
      // Show success message (you can add a toast notification here)
      console.log(`Order ${orderId} created successfully`);
    }
  }, [searchParams]);

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getOrders();
      // API might return array directly or wrapped in data property
      const ordersList = Array.isArray(data) ? data : (data?.data || []);
      setOrders(ordersList);
    } catch (err: any) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return t("orderStatusPending");
      case "confirmed":
        return t("orderStatusConfirmed");
      case "processing":
        return t("orderStatusProcessing");
      case "shipped":
        return t("orderStatusShipped");
      case "delivered":
        return t("orderStatusDelivered");
      case "cancelled":
        return t("orderStatusCancelled");
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "confirmed":
        return "bg-blue-100 text-blue-700";
      case "processing":
        return "bg-purple-100 text-purple-700";
      case "shipped":
        return "bg-indigo-100 text-indigo-700";
      case "delivered":
        return "bg-green-100 text-green-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-zinc-100 text-zinc-700";
    }
  };

  const filteredOrders =
    activeTab === "all"
      ? orders
      : activeTab === "pending"
      ? orders.filter((order) => ["pending", "confirmed", "processing", "shipped"].includes(order.status))
      : orders.filter((order) => order.status === "delivered");

  const pendingCount = orders.filter((o) => 
    ["pending", "confirmed", "processing", "shipped"].includes(o.status)
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  return (
    <div className="flex flex-col bg-zinc-50">
      {/* Header */}
      <AppHeader titleKey="ordersTitle" />

      <main className="flex-1 pb-28">
        {/* Tabs */}
        <div className="mt-4 mx-auto max-w-2xl border-b border-zinc-200 bg-white px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("all")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {t("all")} ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "pending"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {t("processing")} ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "completed"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500"
              }`}
            >
              {t("completed")} ({deliveredCount})
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-6xl">⏳</div>
              <p className="text-zinc-500">{t("loading")}</p>
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
              <p className="text-zinc-500">{t("noOrders")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-xl bg-white shadow-sm"
                >
                  {/* Order Header */}
                  <div className="border-b border-zinc-100 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-900">
                          {t("orderId")}: {order.id.slice(0, 8)}...
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(order.createdAt)}
                        </p>
                        {order.transactionHash && (
                          <a
                            href={`https://bscscan.com/tx/${order.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 text-xs text-blue-600 hover:underline"
                          >
                            {t("viewTransaction")}: {order.transactionHash.slice(0, 10)}...
                          </a>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="p-4">
                    {order.items.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center gap-3 pb-3 last:pb-0"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-100 text-2xl">
                          📦
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-900">
                            {item.productName}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Số lượng: {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900">
                          ${formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Shipping Address */}
                  {order.shippingAddress && (
                    <div className="border-t border-zinc-100 px-4 py-2">
                      <p className="text-xs text-zinc-500">
                        <span className="font-medium">Địa chỉ giao hàng:</span> {order.shippingAddress}
                      </p>
                    </div>
                  )}

                  {/* Order Footer */}
                  <div className="border-t border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">Tổng tiền:</span>
                      <span className="text-lg font-bold text-blue-600">
                        ${formatPrice(order.totalAmount)}
                      </span>
                    </div>
                    {order.isReconsumption && (
                      <div className="mt-2">
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                          Tái tiêu dùng
                        </span>
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      {["pending", "confirmed", "processing", "shipped"].includes(order.status) && (
                        <>
                          {order.status === "pending" && (
                            <button className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                              Hủy đơn
                            </button>
                          )}
                          <button className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                            Theo dõi
                          </button>
                        </>
                      )}
                      {order.status === "delivered" && (
                        <>
                          <button className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                            Mua lại
                          </button>
                          <button className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                            Đánh giá
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
