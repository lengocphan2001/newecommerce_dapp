"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

interface Transaction {
  id: string;
  type: 'commission' | 'order' | 'deposit' | 'withdraw';
  title: string;
  amount: number;
  status: string;
  date: string;
  icon: string;
  iconColor: string;
}

export default function WalletsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ amountVnd: "", proofImageUrl: "", transferNote: "" });
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [bankingConfig, setBankingConfig] = useState<{
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    bankId?: string;
    qrImageUrl?: string;
    isEnabled?: boolean;
    usdtPriceVnd?: number | null;
  } | null>(null);
  const [copiedDeposit, setCopiedDeposit] = useState<string | null>(null);

  const walletAddress = referralInfo?.walletAddress || "";
  const walletBalance = parseFloat(referralInfo?.walletBalance || "0") || 0;

  const parseVndAmount = (value: string): number => {
    const digitsOnly = (value || "").replace(/[^\d]/g, "");
    if (!digitsOnly) return 0;
    return parseInt(digitsOnly, 10);
  };

  const formatVndInput = (value: string): string => {
    const amount = parseVndAmount(value);
    if (!amount) return "";
    return amount.toLocaleString("vi-VN");
  };

  useEffect(() => {
    fetchWalletData();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!showDepositModal) return;
    api.getBankingConfig().then((c) => setBankingConfig(c)).catch(() => setBankingConfig(null));
  }, [showDepositModal]);

  const copyDeposit = async (text: string, field: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDeposit(field);
      setTimeout(() => setCopiedDeposit(null), 2000);
    } catch { /* ignore */ }
  };

  const getDepositVietQrUrl = (): string | null => {
    const bankId = bankingConfig?.bankId?.trim();
    const accountNumber = bankingConfig?.accountNumber?.trim().replace(/\s/g, "");
    const accountName = (bankingConfig?.accountName || "").trim();
    if (!bankId || !accountNumber) return null;
    const template = "compact2";
    const base = `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png`;
    const params = new URLSearchParams();
    const vndAmount = parseVndAmount(depositForm.amountVnd);
    if (vndAmount > 0) params.set("amount", String(vndAmount));
    const addInfo = `${referralInfo?.username || "user"} nap tien vao vi`.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 25);
    params.set("addInfo", addInfo || "nap tien vao vi");
    if (accountName) params.set("accountName", accountName);
    return `${base}?${params.toString()}`;
  };
  const depositVietQrUrl = getDepositVietQrUrl();
  const depositTransferContent = `${referralInfo?.username || "user"} nap tien vao vi`.replace(/\s+/g, " ").trim();

  const fetchOrders = async () => {
    try {
      const data = await api.getOrders();
      const ordersList = Array.isArray(data) ? data : (data?.data || []);
      setOrders(ordersList);
    } catch (err: any) {
      // Check if it's an authentication error and redirect
      if (handleAuthError(err, router)) {
        return; // Redirect is happening
      }
      // User might not be logged in, ignore other errors
    }
  };

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      try {
        const [info, requests] = await Promise.all([
          api.getReferralInfo(),
          api.getMyDepositRequests().catch(() => []),
        ]);
        setReferralInfo(info);
        setDepositRequests(Array.isArray(requests) ? requests : []);
      } catch (err: any) {
        if (handleAuthError(err, router)) return;
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDepositProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofUploading(true);
    setDepositError("");
    try {
      const { url } = await api.uploadDepositProof(file);
      setDepositForm((f) => ({ ...f, proofImageUrl: url }));
    } catch (err: any) {
      setDepositError(err?.message || "Tải ảnh lên thất bại");
    } finally {
      setProofUploading(false);
    }
  };

  const handleSubmitDeposit = async () => {
    setDepositError("");
    const amountVnd = parseVndAmount(depositForm.amountVnd);
    if (!depositForm.amountVnd || isNaN(amountVnd) || amountVnd < 1000) {
      setDepositError("Nhập số tiền đã chuyển (VND) tối thiểu 1.000");
      return;
    }
    setDepositSubmitting(true);
    try {
      await api.createDepositRequest({
        amountVnd,
        proofImageUrl: depositForm.proofImageUrl || undefined,
        transferNote: depositForm.transferNote || undefined,
      });
      setShowDepositModal(false);
      setDepositForm({ amountVnd: "", proofImageUrl: "", transferNote: "" });
      const requests = await api.getMyDepositRequests();
      setDepositRequests(Array.isArray(requests) ? requests : []);
    } catch (err: any) {
      setDepositError(err?.message || "Gửi yêu cầu thất bại");
    } finally {
      setDepositSubmitting(false);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatUSDT = (balance: string | number) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance;
    if (isNaN(num) || num === 0) return "0.00";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  };

  const copyAddress = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (walletAddress) {
      try {
        await navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletAddress;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (fallbackErr) {
          console.error('Failed to copy:', fallbackErr);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const shoppingBalance = parseFloat(referralInfo?.accumulatedPurchases || "0");
  const affiliateBalanceGross = parseFloat(referralInfo?.bonusCommission || "0");
  const feePercent = referralInfo?.payoutFeePercent ?? 10;
  const affiliateBalanceNet = referralInfo?.bonusCommissionNet != null
    ? parseFloat(String(referralInfo.bonusCommissionNet))
    : affiliateBalanceGross * (1 - feePercent / 100);
  const affiliateBalance = affiliateBalanceNet;

  // Helper function to safely format date
  const formatDateSafe = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Helper function to safely create Date for sorting
  const createDateSafe = (dateString: string | null | undefined): string => {
    if (!dateString) return new Date(0).toISOString();
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return new Date(0).toISOString();
      return dateString;
    } catch {
      return new Date(0).toISOString();
    }
  };

  // Recent transactions - combine commissions and orders
  const allTransactions: Transaction[] = [
    // Commissions
    ...(referralInfo?.recentActivity?.map((activity: any) => {
      // Normalize activity type to handle both uppercase and lowercase
      const activityType = String(activity.type || '').toUpperCase();

      // Determine commission type label
      const commissionTitle = activityType === 'DIRECT'
        ? t("directCommission")
        : activityType === 'GROUP'
          ? t("groupCommission")
          : t("managementCommission");

      return {
        id: activity.id,
        type: 'commission' as const,
        title: commissionTitle,
        amount: parseFloat(activity.amount),
        status: activity.status === 'PENDING' ? t("pending") : t("completed"),
        date: formatDateSafe(activity.createdAt),
        createdAt: createDateSafe(activity.createdAt), // Keep original for sorting
        icon: 'call_received',
        iconColor: 'text-[#13ec5b]',
      };
    }) || []),
    // Orders
    ...(orders.map((order: any) => ({
      id: order.id,
      type: 'order' as const,
      title: t("orderPurchase"),
      amount: -order.totalAmount, // Negative for purchases
      status: order.status === 'delivered' ? t("completed") : t("pending"),
      date: formatDateSafe(order.createdAt),
      createdAt: createDateSafe(order.createdAt), // Keep original for sorting
      icon: 'shopping_cart',
      iconColor: 'text-primary-dark',
    })) || []),
  ];

  // Sort by createdAt descending and take top 5
  const transactions: Transaction[] = allTransactions
    .filter((tx: any) => tx.date) // Filter out transactions with invalid dates
    .sort((a: any, b: any) => {
      try {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return dateB - dateA;
      } catch {
        return 0;
      }
    })
    .slice(0, 5)
    .map(({ createdAt, ...rest }: any) => rest); // Remove createdAt before displaying

  if (loading) {
    return (
      <div className="flex flex-col bg-background-gray">
        <AppHeader titleKey="navWallets" />
        <main className="flex-1 pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500">{t("loading")}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background-gray min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_3px_rgba(240,185,11,0.15)]">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-yellow-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("navWallets")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-bold text-primary-dark uppercase tracking-wider">Shopii</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-yellow-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 px-4 bg-white mt-4">
        {/* Số dư hoa hồng + Địa chỉ ví nhận hoa hồng */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-md border border-gray-100">
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-600">Số tiền nhận về ví (sau phí {feePercent}%)</p>
                <button
                  onClick={() => setBalanceVisible(!balanceVisible)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {balanceVisible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
              <h2 className="text-4xl font-bold tracking-tight text-text-dark">
                {balanceVisible ? `$${formatUSDT(affiliateBalance)}` : "••••••"}
              </h2>
              {balanceVisible && affiliateBalanceGross > 0 && (
                <p className="text-xs text-gray-500">
                  Tổng tích lũy: ${formatUSDT(affiliateBalanceGross)} (trước phí {feePercent}%)
                </p>
              )}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Địa chỉ ví nhận hoa hồng (USDT BEP20)</p>
              {walletAddress ? (
                <button
                  onClick={copyAddress}
                  type="button"
                  className="flex items-center gap-2 cursor-pointer group hover:opacity-80 transition-opacity w-full text-left"
                >
                  <p className="text-sm font-mono text-gray-600 group-hover:text-primary-dark transition-colors truncate flex-1">
                    {walletAddress}
                  </p>
                  <span className={`material-symbols-outlined text-[16px] shrink-0 ${copied ? "text-primary-dark" : "text-gray-400 group-hover:text-primary-dark"}`}>
                    {copied ? "check" : "content_copy"}
                  </span>
                </button>
              ) : (
                <p className="text-sm text-gray-500 mb-2">Chưa cập nhật. Cập nhật tại trang cá nhân.</p>
              )}
              <button
                type="button"
                onClick={() => router.push("/home/profile/edit")}
                className="mt-2 text-sm font-medium text-primary-dark hover:text-primary"
              >
                {walletAddress ? "Đổi địa chỉ ví" : "Thêm địa chỉ ví"}
              </button>
            </div>
          </div>
        </div>

        {/* Affiliate Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 rounded-xl bg-white p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-dark text-[20px]">shopping_cart</span>
              <p className="text-xs font-medium text-gray-600">{t("shopping")}</p>
            </div>
            <p className="text-xl font-bold text-text-dark">
              ${formatUSDT(shoppingBalance)}
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-white p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500 text-[20px]">group_work</span>
              <p className="text-xs font-medium text-gray-600">Hoa hồng (sau phí)</p>
            </div>
            <p className="text-xl font-bold text-text-dark">
              ${formatUSDT(affiliateBalance)}
            </p>
          </div>
        </div>

        {/* Ví nạp tiền (banking) */}
        <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Ví nạp tiền</p>
              <p className="text-2xl font-bold text-text-dark mt-1">
                {balanceVisible ? `$${formatUSDT(walletBalance)}` : "••••••"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowDepositModal(true); setDepositError(""); setDepositForm({ amountVnd: "", proofImageUrl: "", transferNote: "" }); }}
              className="rounded-xl bg-primary text-white font-semibold px-4 py-2.5 flex items-center gap-2 hover:opacity-90"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nạp tiền
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Chuyển khoản theo hướng dẫn thanh toán, gửi yêu cầu và đợi admin duyệt để cộng tiền vào ví.</p>
          {depositRequests.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Yêu cầu nạp tiền gần đây</p>
              <div className="space-y-2">
                {depositRequests.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                    <span className="font-mono">{r.amountVnd != null ? `${Number(r.amountVnd).toLocaleString("vi-VN")} VND` : `$${formatUSDT(Number(r.amount || 0))}`}</span>
                    <span className={`font-medium ${r.status === "PENDING" ? "text-amber-600" : r.status === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                      {r.status === "PENDING" ? "Chờ duyệt" : r.status === "APPROVED" ? (r.amount != null ? `Đã cộng $${formatUSDT(Number(r.amount))}` : "Đã duyệt") : "Từ chối"}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Nạp tiền */}
        {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto py-8" onClick={() => !depositSubmitting && setShowDepositModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-text-dark mb-4">Nạp tiền vào ví</h3>

              {/* Bước 1: User nhập số tiền muốn nạp trước */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">1. Số tiền muốn nạp (VND) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={depositForm.amountVnd}
                  onChange={(e) =>
                    setDepositForm((f) => ({
                      ...f,
                      amountVnd: formatVndInput(e.target.value),
                    }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-lg font-medium"
                  placeholder="VD: 500.000"
                />
                <p className="text-xs text-slate-500 mt-1">Sau khi nhập, mã QR sẽ hiển thị bên dưới để bạn chuyển khoản đúng số tiền.</p>
              </div>

              {bankingConfig?.isEnabled && (bankingConfig.accountNumber || bankingConfig.bankName) ? (
                <>
                  <p className="text-sm font-semibold text-slate-700 mb-2">2. Chuyển khoản đến tài khoản sau:</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 mb-3">
                    {bankingConfig.bankName && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Ngân hàng</span>
                        <span className="font-semibold text-slate-900">{bankingConfig.bankName}</span>
                        <button type="button" onClick={() => copyDeposit(bankingConfig.bankName!, "bank")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                          {copiedDeposit === "bank" ? "Đã copy" : "Copy"}
                        </button>
                      </div>
                    )}
                    {bankingConfig.accountNumber && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Số tài khoản</span>
                        <span className="font-mono font-semibold text-slate-900">{bankingConfig.accountNumber}</span>
                        <button type="button" onClick={() => copyDeposit(bankingConfig.accountNumber!, "account")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                          {copiedDeposit === "account" ? "Đã copy" : "Copy"}
                        </button>
                      </div>
                    )}
                    {bankingConfig.accountName && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Chủ tài khoản</span>
                        <span className="font-semibold text-slate-900 uppercase">{bankingConfig.accountName}</span>
                        <button type="button" onClick={() => copyDeposit(bankingConfig.accountName!, "name")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                          {copiedDeposit === "name" ? "Đã copy" : "Copy"}
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-slate-500">Nội dung chuyển khoản</span>
                      <button type="button" onClick={() => copyDeposit(depositTransferContent, "content")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                        {copiedDeposit === "content" ? "Đã copy" : "Copy"}
                      </button>
                    </div>
                    <p className="font-semibold text-slate-900 break-all">{depositTransferContent}</p>
                  </div>
                  {depositVietQrUrl && parseVndAmount(depositForm.amountVnd) >= 1000 ? (
                    <div className="flex flex-col items-center mb-4">
                      <p className="text-xs text-slate-600 mb-2">Quét mã QR để chuyển khoản (số tiền + nội dung đã điền sẵn)</p>
                      <img src={depositVietQrUrl} alt="VietQR nạp ví" className="w-56 h-56 object-contain rounded-lg border border-slate-200 bg-white" />
                    </div>
                  ) : depositVietQrUrl ? (
                    <div className="flex flex-col items-center mb-4">
                      <p className="text-xs text-slate-600 mb-2">Nhập số tiền (tối thiểu 1.000 VND) bên trên để hiện mã QR</p>
                      <div className="w-56 h-56 rounded-lg border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 text-sm text-center px-2">Nhập số tiền VND</div>
                    </div>
                  ) : bankingConfig.qrImageUrl ? (
                    <div className="flex flex-col items-center mb-4">
                      <p className="text-xs text-slate-600 mb-2">Quét mã QR (hoặc nhập số tiền trên để dùng VietQR có sẵn số tiền)</p>
                      <img src={bankingConfig.qrImageUrl} alt="QR chuyển khoản" className="w-56 h-56 object-contain rounded-lg border border-slate-200 bg-white" />
                    </div>
                  ) : null}
                  <div className="border-t border-slate-200 pt-4 mt-4">
                    <p className="text-sm font-semibold text-slate-700 mb-3">3. Sau khi chuyển khoản xong, bấm <strong>Gửi yêu cầu</strong> bên dưới (có thể đính kèm ảnh chứng từ).</p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4">Admin chưa cấu hình ngân hàng. Vui lòng liên hệ để được hướng dẫn nạp tiền.</p>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh chứng từ chuyển khoản (tùy chọn)</label>
                  <input type="file" accept="image/*" onChange={handleDepositProofChange} className="hidden" id="deposit-proof" />
                  <label htmlFor="deposit-proof" className="flex items-center gap-2 cursor-pointer text-sm text-primary-dark">
                    {proofUploading ? "Đang tải lên..." : depositForm.proofImageUrl ? "Đã tải ảnh ✓" : "Chọn ảnh"}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (mã GD, ngân hàng...) (tùy chọn)</label>
                  <textarea
                    value={depositForm.transferNote}
                    onChange={(e) => setDepositForm((f) => ({ ...f, transferNote: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 min-h-[80px]"
                    placeholder="Mã giao dịch, ngân hàng chuyển..."
                  />
                </div>
                {depositError && <p className="text-sm text-red-600">{depositError}</p>}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => !depositSubmitting && setShowDepositModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium">Hủy</button>
                <button type="button" onClick={handleSubmitDeposit} disabled={depositSubmitting} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium disabled:opacity-70">
                  {depositSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="flex flex-col gap-4 pb-20">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-text-dark">{t("recentActivityTitle")}</h3>
            <button
              onClick={() => router.push('/home/wallets/activity')}
              className="text-sm font-medium text-primary-dark hover:text-primary"
            >
              {t("seeAll")}
            </button>
          </div>
          <div className="flex flex-col divide-y divide-gray-200 rounded-xl bg-white border border-gray-100 shadow-sm">
            {transactions.length > 0 ? (
              transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer ${index === 0 ? 'rounded-t-xl' : index === transactions.length - 1 ? 'rounded-b-xl' : ''
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 ${tx.iconColor}`}>
                      <span className="material-symbols-outlined">{tx.icon}</span>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-text-dark">{tx.title}</p>
                      <p className="text-xs text-gray-500">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.type === 'commission' || tx.type === 'deposit' ? 'text-primary-dark' : 'text-text-dark'}`}>
                      {tx.type === 'commission' || tx.type === 'deposit'
                        ? `+$${formatUSDT(Math.abs(tx.amount) * (1 - feePercent / 100))}`
                        : `-$${formatUSDT(Math.abs(tx.amount))}`}
                    </p>
                    <p className="text-xs text-gray-500">{tx.status}{tx.type === 'commission' ? ` (sau phí ${feePercent}%)` : ''}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center p-6">
                <p className="text-sm text-gray-500">{t("noRecentTransactions")}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
