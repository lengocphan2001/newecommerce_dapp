"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TransactionProcessingModal, { ProcessingStep } from "@/app/components/TransactionProcessingModal";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

function PackageCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const purchaseId = searchParams.get("purchaseId") || "";
  const amountParam = searchParams.get("amount");
  const packageName = searchParams.get("packageName") || "Package";
  const amount = amountParam ? parseFloat(amountParam) : 0;

  const [bankingConfig, setBankingConfig] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankId?: string;
    qrImageUrl?: string;
    isEnabled: boolean;
    usdtPriceVnd?: number | null;
  } | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<"bankName" | "accountNumber" | "accountName" | "content" | null>(null);
  const [usdtToVnd, setUsdtToVnd] = useState<number | null>(null);

  useEffect(() => {
    if (!purchaseId || !amount || amount <= 0) {
      router.replace("/home/profile");
      return;
    }
  }, [purchaseId, amount, router]);

  useEffect(() => {
    const adminRate = bankingConfig?.usdtPriceVnd;
    if (typeof adminRate === "number" && adminRate > 0) {
      setUsdtToVnd(adminRate);
      return;
    }
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd")
      .then((res) => res.json())
      .then((data: { tether?: { vnd?: number } }) => {
        const rate = data?.tether?.vnd;
        if (typeof rate === "number" && rate > 0) setUsdtToVnd(rate);
      })
      .catch(() => setUsdtToVnd(null));
  }, [bankingConfig?.usdtPriceVnd]);

  useEffect(() => {
    api.getBankingConfig().then((c) => setBankingConfig(c)).catch(() => setBankingConfig(null));
  }, []);

  /** VietQR URL for package payment: amount (VND) + addInfo = purchaseId (max 25 chars). */
  const getVietQrUrl = (): string | null => {
    const bankId = bankingConfig?.bankId?.trim();
    const accountNumber = bankingConfig?.accountNumber?.trim().replace(/\s/g, "");
    const accountName = (bankingConfig?.accountName || "").trim();
    if (!bankId || !accountNumber) return null;
    const template = "compact2";
    const base = `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png`;
    const params = new URLSearchParams();
    if (usdtToVnd != null && usdtToVnd > 0 && amount > 0) {
      const vndAmount = Math.round(amount * usdtToVnd);
      if (vndAmount > 0) params.set("amount", String(vndAmount));
    }
    const addInfo = (purchaseId || "PACKAGE").replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 25).trim() || "PACKAGE";
    params.set("addInfo", addInfo);
    if (accountName) params.set("accountName", accountName);
    return `${base}?${params.toString()}`;
  };
  const vietQrUrl = getVietQrUrl();

  const copyToClipboard = async (text: string, field: "bankName" | "accountNumber" | "accountName" | "content") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handlePayment = async () => {
    setProcessingStep("success");
    setError("");
  };

  const formatPrice = (p: number) =>
    Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(p);
  const formatVnd = (v: number) =>
    Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
  if (!purchaseId || !amount || amount <= 0) {
    return null;
  }

  return (
    <div className="bg-background-light font-display text-text-main antialiased flex flex-col min-h-screen">
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-purple-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="size-10 flex items-center justify-center rounded-full bg-purple-50 hover:bg-purple-100 text-slate-600">
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-text-main tracking-tight">Thanh toán gói</h1>
        <div className="size-10" />
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-lg mx-auto w-full">
        <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100">
          <p className="text-sm text-slate-500">Gói</p>
          <p className="font-bold text-slate-900 text-lg">{decodeURIComponent(packageName)}</p>
          <p className="text-2xl font-bold text-primary mt-2">{formatPrice(amount)} USDT</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-700">Thanh toán chuyển khoản</h2>
          {bankingConfig?.isEnabled && bankingConfig && (
            <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100 space-y-4">
              <p className="text-sm text-slate-600">Chuyển khoản theo thông tin sau. Ghi nội dung chuyển khoản để admin xác nhận.</p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-0.5">Số tiền</p>
                <p className="font-bold text-slate-900 text-lg">{formatPrice(amount)} USDT</p>
                {usdtToVnd != null && <p className="text-sm text-slate-600 mt-0.5">≈ {formatVnd(amount * usdtToVnd)}</p>}
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Ngân hàng</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{bankingConfig.bankName || "—"}</span>
                    {bankingConfig.bankName && (
                      <button type="button" onClick={() => copyToClipboard(bankingConfig.bankName!, "bankName")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {copiedField === "bankName" ? "Đã copy" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Số TK</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold font-mono text-slate-900 truncate">{bankingConfig.accountNumber || "—"}</span>
                    {bankingConfig.accountNumber && (
                      <button type="button" onClick={() => copyToClipboard(bankingConfig.accountNumber!, "accountNumber")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {copiedField === "accountNumber" ? "Đã copy" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Chủ TK</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{bankingConfig.accountName || "—"}</span>
                    {bankingConfig.accountName && (
                      <button type="button" onClick={() => copyToClipboard(bankingConfig.accountName!, "accountName")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {copiedField === "accountName" ? "Đã copy" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {vietQrUrl && (
                <div className="flex flex-col items-center pt-2">
                  <span className="text-xs text-slate-600 font-medium mb-2">Quét mã QR (số tiền + nội dung đã điền sẵn)</span>
                  <img src={vietQrUrl} alt="VietQR chuyển khoản" className="w-56 h-56 min-w-[224px] min-h-[224px] object-contain rounded-lg border border-slate-200 bg-white" />
                  <a href={vietQrUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-primary font-semibold">Mở / tải ảnh QR</a>
                </div>
              )}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Nội dung chuyển khoản (bắt buộc):</strong>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <code className="flex-1 min-w-0 break-all font-mono bg-amber-100/80 px-2 py-1.5 rounded">{purchaseId}</code>
                  <button type="button" onClick={() => copyToClipboard(purchaseId, "content")} className="shrink-0 px-2 py-1.5 rounded-lg bg-amber-200/80 text-amber-900 text-xs font-semibold">
                    {copiedField === "content" ? "Đã copy" : "Copy"}
                  </button>
                </div>
                <p className="mt-1.5 text-amber-700">Ghi mã đơn gói này để admin xác nhận kích hoạt gói.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="bg-white border-t border-purple-100 p-4 pb-24" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="max-w-lg mx-auto flex gap-4 items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Tổng thanh toán</span>
            <span className="text-2xl font-bold text-slate-900">{formatPrice(amount)}</span>
            <span className="text-sm font-bold text-slate-500 ml-1">USDT</span>
            {usdtToVnd != null && (
              <span className="text-xs text-slate-500 block mt-0.5">≈ {formatVnd(amount * usdtToVnd)}</span>
            )}
          </div>
          <button
            onClick={handlePayment}
            disabled={processingStep !== "idle"}
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingStep !== "idle" ? "Đang xử lý..." : "Tôi đã chuyển khoản"}
          </button>
        </div>
      </div>

      <TransactionProcessingModal
        isOpen={processingStep !== "idle"}
        step={processingStep}
        error={error}
        onClose={() => setProcessingStep("idle")}
        bankingSuccess={
          processingStep === "success"
            ? { orderId: purchaseId, transferContent: purchaseId }
            : undefined
        }
      />

      {error && processingStep === "idle" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg text-sm max-w-md mx-4">
          {error}
        </div>
      )}
    </div>
  );
}

export default function PackageCheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PackageCheckoutContent />
    </Suspense>
  );
}
