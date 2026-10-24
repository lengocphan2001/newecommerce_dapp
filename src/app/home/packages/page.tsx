"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { handleAuthError } from "@/app/utils/auth";

interface PackageItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  price: number;
  level: number;
  isActive: boolean;
  directCommissionRate: number;
  groupCommissionRate: number;
  managementRateF1: number;
  managementRateF2?: number | null;
  managementRateF3?: number | null;
  reconsumptionThreshold: number;
  reconsumptionRequired: number;
}

interface MyPurchase {
  id: string;
  packageId: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  package?: { name: string; code: string };
}

export default function PackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [myPurchases, setMyPurchases] = useState<MyPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Proxy purchase states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const [buyerUsername, setBuyerUsername] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [withdrawBalance, setWithdrawBalance] = useState<number | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [list, purchases] = await Promise.all([
        api.getActivePackages(),
        api.getMyPackagePurchases(),
      ]);
      setPackages(Array.isArray(list) ? list : []);
      setMyPurchases(Array.isArray(purchases) ? purchases : []);
    } catch (err: any) {
      if (handleAuthError(err, router)) return;
      setError(err.message || "Failed to load packages");
      setPackages([]);
      setMyPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWithdrawBalance = async () => {
    try {
      const res = await api.getWithdrawWalletBalance();
      if (res && typeof res.balance === "number") {
        setWithdrawBalance(res.balance);
      }
    } catch {
      setWithdrawBalance(0);
    }
  };

  useEffect(() => {
    load();
    loadWithdrawBalance();
  }, []);

  useEffect(() => {
    if (!isModalOpen || !buyerUsername.trim()) {
      setBuyerName("");
      setValidationError("");
      return;
    }
    setIsValidating(true);
    setValidationError("");
    const timer = setTimeout(async () => {
      try {
        const res = await api.validateDownline(buyerUsername.trim());
        if (res.valid) {
          setBuyerName(res.user.fullName);
          setValidationError("");
        } else {
          setBuyerName("");
          setValidationError(res.message || "Tài khoản không hợp lệ");
        }
      } catch (err: any) {
        setBuyerName("");
        setValidationError(err.message || "Tài khoản không thuộc tuyến dưới của bạn.");
      } finally {
        setIsValidating(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [buyerUsername, isModalOpen]);

  const handlePurchase = async (pkg: PackageItem) => {
    try {
      setPurchasingId(pkg.id);
      setError("");
      const purchase = await api.purchasePackage(pkg.id);
      const purchaseId = purchase?.id ?? (purchase as any)?.data?.id;
      const amount = Number(pkg.price);
      if (purchaseId && amount > 0) {
        router.push(
          `/home/package-checkout?purchaseId=${encodeURIComponent(purchaseId)}&amount=${amount}&packageName=${encodeURIComponent(pkg.name)}`
        );
      } else {
        await load();
      }
    } catch (err: any) {
      if (handleAuthError(err, router)) return;
      setError(err.message || "Failed to request purchase");
    } finally {
      setPurchasingId(null);
    }
  };

  const handleConfirmProxyPurchase = async () => {
    if (!selectedPackage) return;
    try {
      setIsPaying(true);
      setError("");
      await api.purchasePackage(selectedPackage.id, buyerUsername.trim(), true);
      setIsModalOpen(false);
      setBuyerUsername("");
      setBuyerName("");
      setValidationError("");
      await load();
      alert("Mua hộ và kích hoạt gói thành công!");
    } catch (err: any) {
      setError(err.message || "Mua hộ thất bại");
    } finally {
      setIsPaying(false);
    }
  };

  const pendingPurchases = myPurchases.filter((p) => p.status === "pending");

  return (
    <div className="flex flex-col bg-zinc-50 min-h-screen">
      <AppHeader title="Packages" showBack />
      <main className="flex-1 pb-24 px-4 max-w-md md:max-w-4xl lg:max-w-5xl mx-auto w-full" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>
        <p className="text-sm text-zinc-600 mt-2 mb-4">
          Buy a package to activate your commission level (CTV, Đối tác, TV). After payment, admin will confirm and your package will be activated.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {pendingPurchases.length > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-medium text-amber-800">Pending purchases</p>
            <ul className="mt-2 space-y-1 text-sm text-amber-700">
              {pendingPurchases.map((p) => (
                <li key={p.id}>
                  {p.package?.name ?? p.packageId} — ${Number(p.amount).toLocaleString()} (waiting for admin confirmation)
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-zinc-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-zinc-900">{pkg.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{pkg.code}</p>
                    {pkg.description && (
                      <p className="text-sm text-zinc-600 mt-2">{pkg.description}</p>
                    )}
                    <div className="mt-2 text-xs text-zinc-500 space-y-0.5">
                      <p>Direct: {(Number(pkg.directCommissionRate) * 100).toFixed(1)}% · Group: {(Number(pkg.groupCommissionRate) * 100).toFixed(1)}%</p>
                      <p>Management C1: {(Number(pkg.managementRateF1) * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-violet-600">
                      ${Number(pkg.price).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePurchase(pkg)}
                        disabled={!!purchasingId}
                        className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition"
                      >
                        {purchasingId === pkg.id ? "..." : "Buy package"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setIsModalOpen(true);
                        }}
                        disabled={!!purchasingId}
                        className="px-4 py-2 rounded-lg border border-violet-600 text-violet-600 text-sm font-medium hover:bg-violet-50 disabled:opacity-50 transition"
                      >
                        Mua hộ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <p className="text-center text-zinc-500 py-8">No packages available.</p>
            )}
          </div>
        )}
      </main>

      {/* Modal Mua Hộ */}
      {isModalOpen && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-purple-100 flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Mua hộ: {selectedPackage.name}</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setBuyerUsername("");
                  setBuyerName("");
                  setValidationError("");
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Input Username */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Username của cấp dưới</label>
              <div className="relative">
                <input
                  type="text"
                  className={`w-full h-10 pl-3 pr-10 rounded-xl border text-sm text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none transition ${
                    validationError
                      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : buyerName
                      ? "border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      : "border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  }`}
                  placeholder="Nhập username..."
                  value={buyerUsername}
                  onChange={(e) => setBuyerUsername(e.target.value)}
                />
                {isValidating && (
                  <div className="absolute right-3 top-2.5">
                    <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                {!isValidating && buyerName && (
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-emerald-500 text-[20px]">check_circle</span>
                )}
                {!isValidating && validationError && (
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-red-500 text-[20px]">error</span>
                )}
              </div>
            </div>

            {buyerName && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">account_circle</span>
                <div>
                  <span>Tài khoản: </span>
                  <strong className="font-semibold">{buyerName}</strong>
                </div>
              </div>
            )}

            {validationError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>{validationError}</span>
              </div>
            )}

            {/* Số dư Ví Thưởng */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-500 font-medium">Số dư ví thưởng của bạn</p>
              <p className="text-sm font-bold text-slate-800">
                {withdrawBalance != null ? `${Number(withdrawBalance).toLocaleString()} PV` : "— PV"}
              </p>
              <p className="text-slate-500">
                Giá gói: <strong className="text-slate-700">${Number(selectedPackage.price).toLocaleString()} PV</strong>
              </p>
            </div>

            {withdrawBalance != null && withdrawBalance < Number(selectedPackage.price) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800 leading-normal">
                Số dư ví thưởng của bạn không đủ để thanh toán gói này.
              </div>
            )}

            {/* Nút hành động */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setBuyerUsername("");
                  setBuyerName("");
                  setValidationError("");
                }}
                className="flex-1 h-10 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmProxyPurchase}
                disabled={
                  isPaying ||
                  isValidating ||
                  !buyerName ||
                  !!validationError ||
                  (withdrawBalance != null && withdrawBalance < Number(selectedPackage.price))
                }
                className="flex-1 h-10 rounded-xl bg-violet-600 hover:bg-violet-750 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition"
              >
                {isPaying ? "..." : "Thanh toán"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
