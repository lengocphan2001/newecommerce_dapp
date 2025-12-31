"use client";

import React, { useEffect, useState } from "react";
import BottomNav from "../../components/BottomNav";

export default function OrdersPage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "completed">(
    "all"
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900"></div>
      </div>
    );
  }

  const orders = [
    {
      id: "ORD-001",
      date: "15/01/2024",
      status: "pending",
      statusText: "Đang xử lý",
      items: [
        { name: "iPhone 15 Pro Max", quantity: 1, price: "29.990.000" },
      ],
      total: "29.990.000",
      image: "📱",
    },
    {
      id: "ORD-002",
      date: "10/01/2024",
      status: "completed",
      statusText: "Đã giao",
      items: [
        { name: "Áo thun nam", quantity: 2, price: "299.000" },
        { name: "Giày thể thao", quantity: 1, price: "1.990.000" },
      ],
      total: "2.588.000",
      image: "👕",
    },
    {
      id: "ORD-003",
      date: "05/01/2024",
      status: "completed",
      statusText: "Đã giao",
      items: [{ name: "Máy lọc không khí", quantity: 1, price: "3.990.000" }],
      total: "3.990.000",
      image: "🏠",
    },
    {
      id: "ORD-004",
      date: "20/12/2023",
      status: "pending",
      statusText: "Đang vận chuyển",
      items: [{ name: "Tai nghe AirPods Pro", quantity: 1, price: "5.990.000" }],
      total: "5.990.000",
      image: "🎧",
    },
  ];

  const filteredOrders =
    activeTab === "all"
      ? orders
      : orders.filter((order) => order.status === activeTab);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "completed":
        return "bg-green-100 text-green-700";
      default:
        return "bg-zinc-100 text-zinc-700";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="text-xl font-bold text-zinc-900">Đơn hàng của tôi</h1>
        </div>
      </header>

      <main className="flex-1 pb-20">
        {/* Tabs */}
        <div className="mx-auto max-w-2xl border-b border-zinc-200 bg-white px-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("all")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500"
              }`}
            >
              Tất cả ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "pending"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500"
              }`}
            >
              Đang xử lý (
              {orders.filter((o) => o.status === "pending").length})
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "completed"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500"
              }`}
            >
              Đã giao (
              {orders.filter((o) => o.status === "completed").length})
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-6xl">📦</div>
              <p className="text-zinc-500">Chưa có đơn hàng nào</p>
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
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          Mã đơn: {order.id}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {order.date}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.statusText}
                      </span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="p-4">
                    {order.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 pb-3 last:pb-0"
                      >
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-100 text-2xl">
                          {order.image}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-900">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Số lượng: {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {item.price} đ
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer */}
                  <div className="border-t border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">Tổng tiền:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {order.total} đ
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {order.status === "pending" && (
                        <>
                          <button className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                            Hủy đơn
                          </button>
                          <button className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700">
                            Theo dõi
                          </button>
                        </>
                      )}
                      {order.status === "completed" && (
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

      <BottomNav />
    </div>
  );
}
