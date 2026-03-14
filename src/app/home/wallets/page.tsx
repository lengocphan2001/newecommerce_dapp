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

  const walletAddress = referralInfo?.walletAddress || "";

  useEffect(() => {
    fetchWalletData();
    fetchOrders();
  }, []);

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
        const info = await api.getReferralInfo();
        setReferralInfo(info);
      } catch (err: any) {
        if (handleAuthError(err, router)) return;
      }
    } catch (error) {
    } finally {
      setLoading(false);
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
