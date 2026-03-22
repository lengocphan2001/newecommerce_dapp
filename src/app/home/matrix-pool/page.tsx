"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useRouter } from "next/navigation";
import { handleAuthError } from "@/app/utils/auth";

type MatrixMe = {
  positions: Array<{
    treeLevel: number;
    treeId: string;
    nodeId: string;
    earnedOnTreeUsd: number;
  }>;
  excludedTreeLevels: number[];
  config: {
    minOrderUsd: number;
    perSlotUsd: number;
    maxEarnPerTreeUsd: number;
    maxUplines: number;
  };
};

export default function MatrixPoolPage() {
  const router = useRouter();
  const [data, setData] = useState<MatrixMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const me = await api.getMatrixRewardMe();
        if (!cancelled) setData(me as MatrixMe);
      } catch (e: unknown) {
        if (handleAuthError(e, router)) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex flex-col min-h-screen bg-background-gray">
      <div className="relative z-10 flex flex-col w-full max-w-md mx-auto">
        <AppHeader title="Matrix pool" showBack={true} showMenu={false} showActions={false} />

        <div
          className="flex-1 px-4 py-4 space-y-4 pb-28"
          style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <p className="text-sm text-gray-600">
            Pool matrix: mỗi đơn đạt ngưỡng USDT sẽ xếp bạn vào <strong>cây tiếp theo</strong> (BFS). Tối đa{" "}
            <strong>{data?.config?.maxUplines ?? "—"}</strong> upline nhận{" "}
            <strong>${data?.config?.perSlotUsd ?? "—"}</strong> / lần. Trần{" "}
            <strong>${data?.config?.maxEarnPerTreeUsd ?? "—"}</strong> / cây → ra cây và không vào lại cây đó.
          </p>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Điều kiện đơn hàng</p>
            <p className="text-lg font-bold text-primary">
              Đơn CONFIRMED ≥ {data?.config?.minOrderUsd ?? "—"} USDT
            </p>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          {!loading && data && (
            <>
              <h2 className="text-base font-bold text-gray-900">Vị trí của bạn</h2>
              {data.positions.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Chưa có node trên matrix. Mua đơn đủ điều kiện để được thêm vào cây 1.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.positions.map((p) => (
                    <li
                      key={p.nodeId}
                      className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">Cây {p.treeLevel}</p>
                        <p className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{p.nodeId}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Đã nhận (cây này)</p>
                        <p className="font-bold text-violet-700">${p.earnedOnTreeUsd.toFixed(2)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {data.excludedTreeLevels.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Bạn đã đạt trần và không còn trên: cây{" "}
                  {data.excludedTreeLevels.sort((a, b) => a - b).join(", ")}.
                </div>
              )}
            </>
          )}

          <Link
            href="/home/affiliate"
            className="block text-center text-sm font-semibold text-primary underline underline-offset-2"
          >
            ← Quay lại Affiliate
          </Link>
        </div>
      </div>
    </div>
  );
}
