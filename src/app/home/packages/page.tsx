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

  useEffect(() => {
    load();
  }, []);

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

  const pendingPurchases = myPurchases.filter((p) => p.status === "pending");

  return (
    <div className="flex flex-col bg-zinc-50 min-h-screen">
      <AppHeader title="Packages" showBack />
      <main className="flex-1 pb-24 px-4 max-w-md mx-auto w-full" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>
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
          <div className="space-y-4">
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
                    <button
                      type="button"
                      onClick={() => handlePurchase(pkg)}
                      disabled={!!purchasingId}
                      className="mt-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                    >
                      {purchasingId === pkg.id ? "..." : "Buy package"}
                    </button>
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
    </div>
  );
}
