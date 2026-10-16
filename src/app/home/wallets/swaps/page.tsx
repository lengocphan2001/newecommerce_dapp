"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import BottomNav from "@/app/components/BottomNav";
import { api } from "@/app/services/api";
import { handleAuthError } from "@/app/utils/auth";

const PAGE_SIZE = 20;

type WalletSwap = {
  id: string;
  amount: number;
  rate: number | null;
  amountVnd: number | null;
  createdAt: string;
};

/** Lịch sử chuyển số dư từ ví thưởng sang ví tiêu dùng của user. */
export default function WalletSwapsPage() {
  const router = useRouter();
  const [items, setItems] = useState<WalletSwap[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmountVnd, setTotalAmountVnd] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // Tỷ giá rút, chỉ dùng cho bản ghi cũ không lưu amountVnd
  const [withdrawRate, setWithdrawRate] = useState(24000);

  const loadPage = async (nextPage: number) => {
    const res = await api.getMyWalletSwaps({ page: nextPage, limit: PAGE_SIZE });
    setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
    setTotal(res.total);
    setTotalAmountVnd(res.totalAmountVnd);
    setPage(nextPage);
  };

  useEffect(() => {
    (async () => {
      try {
        const [, bankCfg] = await Promise.all([
          loadPage(1),
          api.getBankingConfig().catch(() => null),
        ]);
        const rate = Number(bankCfg?.usdtWithdrawPriceVnd);
        if (rate > 0) setWithdrawRate(rate);
      } catch (err) {
        if (handleAuthError(err, router)) return;
        setError("Không tải được lịch sử chuyển ví");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadPage(page + 1);
    } catch {
      setError("Không tải được lịch sử chuyển ví");
    } finally {
      setLoadingMore(false);
    }
  };

  const swapVnd = (s: WalletSwap) =>
    s.amountVnd != null ? Number(s.amountVnd) : Math.round(Number(s.amount || 0) * withdrawRate);

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  return (
    <div className="flex flex-col bg-background-light min-h-screen">
      <AppHeader title="Lịch sử chuyển ví" showBack onBack={() => router.push("/home/wallets")} />

      <main className="flex-1 pb-24 px-4 pt-4 space-y-4">
        <div className="relative overflow-hidden premium-card p-5">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-cyan-500" />
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <span>Ví thưởng</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
            <span>Ví tiêu dùng</span>
          </div>
          <p className="text-2xl font-bold text-text-dark mt-1">
            {totalAmountVnd.toLocaleString("vi-VN")} ₫
          </p>
          <p className="text-xs text-gray-500 mt-1">Tổng đã chuyển qua {total} lần</p>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-8">Đang tải...</p>
        ) : error && items.length === 0 ? (
          <p className="text-center text-red-600 py-8">{error}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-300">swap_horiz</span>
            <p className="text-sm text-gray-500 mt-2">Bạn chưa chuyển tiền sang ví tiêu dùng lần nào.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl overflow-hidden shadow-sm">
              {items.map((s, index) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 px-4 min-h-[72px] py-3 justify-between ${index < items.length - 1 ? "border-b border-[#f0f2f5]" : ""}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="bg-cyan-50 text-cyan-600 flex items-center justify-center rounded-xl shrink-0 size-12">
                      <span className="material-symbols-outlined">swap_horiz</span>
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <p className="text-[#0d121b] text-base font-semibold leading-normal truncate">
                        Chuyển sang ví tiêu dùng
                      </p>
                      <p className="text-[#4c669a] text-xs" suppressHydrationWarning>
                        {formatDateTime(s.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-[#0d121b]">
                      {swapVnd(s).toLocaleString("vi-VN")} ₫
                    </p>
                    <span className="text-[10px] font-bold uppercase text-green-500">Hoàn thành</span>
                  </div>
                </div>
              ))}
            </div>

            {error && <p className="text-center text-sm text-red-600">{error}</p>}
            {items.length < total && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-2.5 rounded-xl border border-gray-300 font-medium text-sm disabled:opacity-60"
              >
                {loadingMore ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
