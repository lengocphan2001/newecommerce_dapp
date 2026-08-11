"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";
import { QRCodeSVG } from "qrcode.react";

export default function AffiliatePage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [referralInfo, setReferralInfo] = useState<{
    referralCode: string;
    referralLink: string;
    leftLink?: string;
    rightLink?: string;
    username: string;
    fullName: string;
    treeStats: {
      left: { count: number; members: any[]; volume?: number; monthlyVolume?: number };
      right: { count: number; members: any[]; volume?: number; monthlyVolume?: number };
      total: number;
      newTodayCount?: number;
      weakBranchTotalVolume?: number;
    };
    accumulatedPurchases?: string;
    bonusCommission?: string;
    currentMonthCommission?: string;
    fakeReceivedCommission?: string;
    packageType?: string;
    totalReconsumptionAmount?: string;
    walletAddress?: string;
    pendingRewards?: string;
    minPayoutThreshold?: number;
    recentActivity?: Array<{
      id: string;
      type: string;
      amount: string;
      status: string;
      createdAt: string;
      fromUserId?: string;
      fromUsername?: string;
    }>;
    maxCommission?: string;
    monthlyStats?: {
      month: string;
      calculatedRank: string;
      groupSales: string;
      personalSales: string;
      groupRewardAmount: string;
      globalShareAmount: string;
      isProcessed: boolean;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showReferralQr, setShowReferralQr] = useState(false);
  const [commissionConfigs, setCommissionConfigs] = useState<{
    CTV?: { packageValue: number };
    NPP?: { packageValue: number };
  }>({});
  const [currentPackageConfig, setCurrentPackageConfig] = useState<any>(null);
  const [f1List, setF1List] = useState<Array<{
    id: string;
    username: string | null;
    fullName: string;
    email: string;
    packageType: string;
    createdAt: string;
    directReferralCount: number;
  }>>([]);
  const [f1Loading, setF1Loading] = useState(false);

  useEffect(() => {
    fetchReferralInfo();
  }, []);

  const fetchReferralInfo = async () => {
    try {
      setLoading(true);
      const info = await api.getReferralInfo();
      setReferralInfo(info);
    } catch (err: any) {
      // Check if it's an authentication error and redirect
      if (handleAuthError(err, router)) {
        return; // Redirect is happening, don't set error state
      }
      setError(err.message || t("affiliateError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      if (referralInfo?.packageType && referralInfo.packageType !== 'NONE') {
        try {
          const config = await api.getCommissionConfig(referralInfo.packageType);
          setCurrentPackageConfig(config);
        } catch (e) {
          console.error("Failed to load package config", e);
        }
      }
    };
    loadConfig();
  }, [referralInfo?.packageType]);

  useEffect(() => {
    if (!referralInfo) return;
    const loadF1 = async () => {
      setF1Loading(true);
      try {
        const list = await api.getF1List();
        setF1List(list);
      } catch (e) {
        console.error("Failed to load F1 list", e);
        setF1List([]);
      } finally {
        setF1Loading(false);
      }
    };
    loadF1();
  }, [referralInfo]);

  const getMaxCommission = () => {
    if (referralInfo?.maxCommission) {
      return parseFloat(referralInfo.maxCommission);
    }
    if (!currentPackageConfig) return 0;
    // Use dynamic reconsumption threshold from package config
    // Fallback logic if needed, but ideally backend provides this
    return currentPackageConfig.reconsumptionThreshold || 0;
  };
  const shortAddress = (address?: string) => {
    if (!address) return t("notConnected");
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (
    text: string,
    key: string,
    e?: React.MouseEvent
  ) => {
    e?.preventDefault();
    e?.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
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
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
      } catch (fallbackErr) {
        console.error("Failed to copy:", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  };

  const formatVolume = (volume: string | number) => {
    const num = typeof volume === "string" ? parseFloat(volume) : volume;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(num);
  };

  const formatPriceVND = (volume: string | number) => {
    const num = typeof volume === "string" ? parseFloat(volume) : volume;
    const vndAmount = num * 25000;
    return vndAmount.toLocaleString("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const getRank = (packageType?: string, accumulatedPurchases?: string | number) => {
    const total = Number(accumulatedPurchases) || 0;
    if (total >= 600) {
      return "Đại lý";
    }
    const type = String(packageType || '').toUpperCase();
    if (type === 'NPP' || type === 'DT') return "Đối Tác";
    if (type === 'CTV') return "CTV";
    if (type === 'TV') return "Thành Viên";
    return type || "NONE";
  };

  const getRankBadgeInfo = () => {
    if (!referralInfo) return { label: 'Customer', class: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'person' };
    
    const monthlyRank = referralInfo.monthlyStats?.calculatedRank;
    const hasMonthlyRank = monthlyRank && monthlyRank !== 'DAILY' && monthlyRank !== 'C0';
    
    if (hasMonthlyRank) {
      let badgeClass = '';
      let icon = 'military_tech';
      
      switch (monthlyRank) {
        case 'C1':
          badgeClass = 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-amber-500 font-bold shadow-sm';
          icon = 'workspace_premium';
          break;
        case 'C2':
          badgeClass = 'bg-gradient-to-r from-slate-400 to-slate-500 text-white border-slate-300 font-bold shadow-sm';
          icon = 'workspace_premium';
          break;
        case 'C3':
          badgeClass = 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-yellow-300 font-bold shadow-md';
          icon = 'workspace_premium';
          break;
        case 'C4':
          badgeClass = 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-300 font-bold shadow-md';
          icon = 'grade';
          break;
        case 'C5':
          badgeClass = 'bg-gradient-to-r from-rose-500 to-red-600 text-white border-rose-400 font-bold shadow-md';
          icon = 'favorite';
          break;
        case 'C6':
          badgeClass = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400 font-bold shadow-md';
          icon = 'diamond';
          break;
        case 'C7':
          badgeClass = 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-300 font-bold shadow-md animate-pulse';
          icon = 'stars';
          break;
        case 'C8':
          badgeClass = 'bg-gradient-to-r from-fuchsia-600 via-purple-600 to-violet-600 text-white border-fuchsia-400 font-bold shadow-lg animate-pulse';
          icon = 'emoji_events';
          break;
        case 'C9':
          badgeClass = 'bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600 text-white border-yellow-300 font-extrabold shadow-lg animate-pulse';
          icon = 'crown';
          break;
        default:
          badgeClass = 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border-gray-400 font-bold';
          icon = 'military_tech';
      }
      
      return {
        label: monthlyRank,
        class: badgeClass,
        icon
      };
    }
    
    const total = Number(referralInfo.accumulatedPurchases) || 0;
    if (total >= 600) {
      return {
        label: lang === "vi" ? "Đại lý" : "Agency",
        class: 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-teal-300 font-bold shadow-sm',
        icon: 'stars'
      };
    }
    
    const type = String(referralInfo.packageType || '').toUpperCase();
    if (type === 'NPP' || type === 'DT') {
      return {
        label: lang === "vi" ? "Đối Tác" : "Đối Tác",
        class: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
        icon: 'badge'
      };
    }
    
    if (type === 'CTV') {
      return {
        label: lang === "vi" ? "CTV" : "CTV",
        class: 'bg-purple-50 text-purple-700 border-purple-200 font-medium',
        icon: 'storefront'
      };
    }
    
    if (type === 'TV') {
      return {
        label: lang === "vi" ? "Thành Viên" : "Member",
        class: 'bg-gray-50 text-gray-500 border-gray-200',
        icon: 'person'
      };
    }
    
    return {
      label: type || "NONE",
      class: 'bg-gray-50 text-gray-500 border-gray-200',
      icon: 'person'
    };
  };

  const getNextRank = (packageType?: string) => {
    // This is hard to determine dynamically without knowing the full hierarchy order on frontend
    // For now, if we are not at the top level, show "Next Level" or similar
    // Or we could fetch all packages and find the next one by level
    return "Next Level";
  };

  const getRankProgress = (packageType?: string, purchases?: string) => {
    // Simplified progress logic or rely on backend providing progress
    const amount = parseFloat(purchases || "0");
    if (currentPackageConfig && currentPackageConfig.price > 0) {
      return Math.min(100, (amount / currentPackageConfig.price) * 100);
    }
    return 0;
  };

  // Calculate new users today - must be before early returns to follow Rules of Hooks
  const isToday = (date: Date | string) => {
    const today = new Date();
    const checkDate = typeof date === "string" ? new Date(date) : date;
    return (
      checkDate.getDate() === today.getDate() &&
      checkDate.getMonth() === today.getMonth() &&
      checkDate.getFullYear() === today.getFullYear()
    );
  };

  const newTodayCount = useMemo(() => {
    if (!referralInfo) return 0;
    const fromApi = (referralInfo.treeStats as { newTodayCount?: number })
      ?.newTodayCount;
    if (typeof fromApi === "number") {
      return fromApi;
    }
    const leftMembers = referralInfo.treeStats.left.members || [];
    const rightMembers = referralInfo.treeStats.right.members || [];
    const allMembers = [...leftMembers, ...rightMembers];
    return allMembers.filter(
      (member: any) => member.createdAt && isToday(member.createdAt)
    ).length;
  }, [referralInfo]);

  /** Hoạt động gần đây: chỉ hoa hồng Direct (type direct), không hiển thị group/management/product… */
  const directRecentActivity = useMemo(() => {
    const list = referralInfo?.recentActivity;
    if (!list?.length) return [];
    return list.filter(
      (a) => String(a.type || "").toLowerCase() === "direct",
    );
  }, [referralInfo?.recentActivity]);

  if (loading) {
    return (
      <div className="flex flex-col bg-background-gray">
        <AppHeader titleKey="navAffiliate" showBack={true} />
        <main className="flex-1">
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500">{t("affiliateLoading")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !referralInfo) {
    return (
      <div className="flex flex-col bg-background-gray">
        <AppHeader titleKey="navAffiliate" showBack={true} />
        <main className="flex-1">
          <div className="px-4 py-8 text-center">
            <p className="text-red-500">{error || t("affiliateNotFound")}</p>
          </div>
        </main>
      </div>
    );
  }

  const leftVolume =
    typeof referralInfo.treeStats.left.volume === "number"
      ? referralInfo.treeStats.left.volume
      : parseFloat(referralInfo.treeStats.left.volume || "0") || 0;
  const rightVolume =
    typeof referralInfo.treeStats.right.volume === "number"
      ? referralInfo.treeStats.right.volume
      : parseFloat(referralInfo.treeStats.right.volume || "0") || 0;

  // Doanh số nhánh tháng hiện tại (CONFIRMED)
  const leftMonthlyVolume =
    typeof referralInfo.treeStats.left.monthlyVolume === "number"
      ? referralInfo.treeStats.left.monthlyVolume
      : parseFloat(String(referralInfo.treeStats.left.monthlyVolume ?? "0")) || 0;
  const rightMonthlyVolume =
    typeof referralInfo.treeStats.right.monthlyVolume === "number"
      ? referralInfo.treeStats.right.monthlyVolume
      : parseFloat(String(referralInfo.treeStats.right.monthlyVolume ?? "0")) || 0;

  // Xác định nhánh yếu tại thời điểm đầu tháng (trước khi có doanh số tháng này)
  const leftVolumeAtStart = leftVolume - leftMonthlyVolume;
  const rightVolumeAtStart = rightVolume - rightMonthlyVolume;
  const startOfMonthWeakSide = leftVolumeAtStart <= rightVolumeAtStart ? "left" : "right";
  const weakBranchMonthlyVolume = startOfMonthWeakSide === "left" ? leftMonthlyVolume : rightMonthlyVolume;

  // Doanh số nhánh yếu tích lũy (cộng dồn doanh số tính thưởng của các tháng từ tháng 7/2026 trở đi)
  const weakBranchTotalVolume = referralInfo.treeStats?.weakBranchTotalVolume !== undefined
    ? (typeof referralInfo.treeStats.weakBranchTotalVolume === "number"
        ? referralInfo.treeStats.weakBranchTotalVolume
        : parseFloat(String(referralInfo.treeStats.weakBranchTotalVolume)) || 0)
    : Math.min(leftVolume, rightVolume);

  // Doanh số chênh lệch (Target Sales Volume) = Nhánh lớn - Nhánh nhỏ
  const targetVolume = Math.abs(leftVolume - rightVolume);

  const maxCommission = getMaxCommission();
  const receivedCommission =
    (typeof referralInfo.bonusCommission === "string"
      ? parseFloat(referralInfo.bonusCommission || "0")
      : Number(referralInfo.bonusCommission) || 0) +
    (typeof referralInfo.fakeReceivedCommission === "string"
      ? parseFloat(referralInfo.fakeReceivedCommission || "0")
      : Number(referralInfo.fakeReceivedCommission) || 0);

  return (
    <div className="flex flex-col bg-background-gray antialiased">
      {/* Content Wrapper */}
      <div className="relative z-10 flex flex-col w-full max-w-md mx-auto bg-transparent overflow-hidden">
        {/* Top App Bar */}
        <AppHeader
          titleKey="navAffiliate"
          showBack={true}
          showMenu={false}
          showActions={false}
          right={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                <span className="text-xs font-semibold text-primary-dark">
                  Shoplife
                </span>
              </div>
              <button className="flex items-center justify-center rounded-full h-10 w-10 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm">
                <span className="material-symbols-outlined text-primary-dark">
                  account_balance_wallet
                </span>
              </button>
            </div>
          }
        />

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto bg-white pb-24"
          style={{
            paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {/* Main Grid for desktop/tablet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-4">
            
            {/* Left Column: Profile & Stats */}
            <div className="space-y-4">
              {/* Compact Profile Header */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
                <div className="relative">
                  <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14 ring-2 ring-primary ring-offset-2 ring-offset-white bg-gradient-to-br from-primary/20 to-white">
                    <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">
                        person
                      </span>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                    <span
                      className="material-symbols-outlined text-[18px] text-primary"
                      title="Verified"
                    >
                      verified
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold leading-tight text-text-dark">
                      {shortAddress(referralInfo.walletAddress)}
                    </p>
                    {(() => {
                      const badge = getRankBadgeInfo();
                      return (
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border shadow-sm transition-all duration-300 ${badge.class}`}>
                          <span className="material-symbols-outlined text-[14px] font-bold">{badge.icon}</span>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-primary-dark text-sm font-medium">
                    Hoa hồng tháng này:{" "}
                    {formatPrice(referralInfo.currentMonthCommission || "0")} PV
                  </p>
                </div>
              </div>

              {/* Quick Stats Card */}
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-primary-dark text-xl">
                    group
                  </span>
                  <span className="text-xs font-medium text-gray-600">
                    {t("activeUsers")}
                  </span>
                </div>
                <p className="text-text-dark text-lg font-bold">
                  {referralInfo.treeStats.total} {t("affiliateTotal")}
                </p>
                <p className="text-[10px] text-primary-dark mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px]">
                    arrow_upward
                  </span>
                  {newTodayCount} {t("newToday")}
                </p>
              </div>
            </div>

            {/* Right Column: Binary Volume Cards */}
            <div className="space-y-4">
              {/* Maximum Commission & Branch Totals */}
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <h4 className="text-sm font-bold text-text-dark mb-3">
                  {t("commission")} & {t("networkStructure")}
                </h4>
                <div className="space-y-3">
                  {/* Total Commission Can Receive */}
                  {referralInfo.packageType !== "NONE" && (
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                      <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                        <span className="material-symbols-outlined text-primary text-xl">
                          account_balance_wallet
                        </span>
                        <span className="text-sm font-bold text-gray-800">
                          {lang === "vi" ? "Thông tin hoa hồng" : "Commission Info"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 font-medium">
                            {lang === "vi" ? "Đã nhận" : "Received"}
                          </span>
                          <span className="font-bold text-slate-800">
                            {formatPriceVND(receivedCommission)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 font-medium">
                            {lang === "vi" ? "Có thể nhận" : "Can receive"}
                          </span>
                          <span className="font-bold text-primary-dark">
                            {formatPriceVND(maxCommission)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Nhánh yếu tháng hiện tại */}
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-amber-600 text-xl">trending_down</span>
                      <span className="text-sm font-bold text-amber-800">
                        {lang === "vi" ? "Doanh số tính thưởng" : "Doanh số tính thưởng"}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-amber-700">
                      {formatPriceVND(weakBranchMonthlyVolume)}
                    </p>
                  </div>

                  {/* Doanh số nhánh yếu (Tích lũy) */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-blue-600 text-xl">insights</span>
                      <span className="text-sm font-bold text-blue-800">
                        {lang === "vi" ? "Doanh số tích lũy" : "Weak Leg Volume"}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatPriceVND(weakBranchTotalVolume)}
                    </p>
                  </div>

                  {/* Doanh số cần đạt */}
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-purple-600 text-xl">ads_click</span>
                      <span className="text-sm font-bold text-purple-800">
                        {lang === "vi" ? "Doanh số chênh lệch" : "Target Sales Volume"}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                      {formatPriceVND(targetVolume)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* F1 List & Performance */}
          <div className="px-4 py-2">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <h4 className="text-sm font-bold text-text-dark mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">group</span>
                {t("f1ListTitle")} ({f1List.length})
              </h4>
              {f1Loading ? (
                <p className="text-sm text-gray-500 py-4">{t("affiliateLoading")}</p>
              ) : f1List.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">{t("f1Empty")}</p>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="py-2 px-1 font-medium">{t("username")}</th>
                          <th className="py-2 px-1 font-medium hidden sm:table-cell">{t("fullName")}</th>
                          <th className="py-2 px-1 font-medium">{t("rank")}</th>
                          <th className="py-2 px-1 font-medium text-center">{t("f1DirectReferrals")}</th>
                          <th className="py-2 px-1 font-medium hidden sm:table-cell">{t("f1JoinedDate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f1List.slice(0, 5).map((f1) => (
                          <tr key={f1.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="py-2.5 px-1 font-medium text-text-dark">{f1.username || "-"}</td>
                            <td className="py-2.5 px-1 text-gray-600 hidden sm:table-cell truncate max-w-[120px]">{f1.fullName || "-"}</td>
                            <td className="py-2.5 px-1">
                              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{f1.packageType || "NONE"}</span>
                            </td>
                            <td className="py-2.5 px-1 text-center">
                              <span className="inline-flex items-center justify-center min-w-[1.75rem] font-semibold text-primary-dark bg-primary/10 rounded-full text-xs">
                                {f1.directReferralCount}
                              </span>
                            </td>
                            <td className="py-2.5 px-1 text-gray-500 text-xs hidden sm:table-cell">
                              {f1.createdAt ? new Date(f1.createdAt).toLocaleDateString() : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {f1List.length > 0 && (
                    <Link
                      href="/home/affiliate/f1"
                      className="mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-primary/10 text-primary-dark font-medium text-sm hover:bg-primary/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">list</span>
                      {t("viewFullF1List")} ({f1List.length})
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Referral Tools — một link; team trái/phải chọn ở trang đăng ký */}
          <div className="px-4 py-4 mb-2">
            <h3 className="text-lg font-bold mb-3 px-1 text-text-dark">
              {t("referralTools")}
            </h3>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex flex-col gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-gray-600 mb-1 block">
                    {t("referralRegisterLink")}
                  </label>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 pr-1 border border-gray-200">
                    <input
                      className="bg-transparent border-none text-text-dark text-sm w-full focus:ring-0 px-2 truncate font-mono"
                      readOnly
                      type="text"
                      value={referralInfo.referralLink || ""}
                    />
                    <button
                      type="button"
                      onClick={(e) =>
                        copyToClipboard(referralInfo.referralLink || "", "referral", e)
                      }
                      disabled={!referralInfo.referralLink}
                      className="bg-primary/10 hover:bg-primary/20 text-primary-dark p-2 rounded-md transition-colors shrink-0 relative z-10 disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {copied === "referral" ? "check" : "content_copy"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReferralQr((v) => !v)}
                      disabled={!referralInfo.referralLink}
                      className="bg-primary/10 hover:bg-primary/20 text-primary-dark p-2 rounded-md transition-colors shrink-0 relative z-10 disabled:opacity-40"
                    >
                      <span className="material-symbols-outlined text-lg">qr_code</span>
                    </button>
                  </div>
                </div>
                {showReferralQr && referralInfo.referralLink ? (
                  <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <QRCodeSVG value={referralInfo.referralLink} size={200} />
                    <p className="text-xs text-gray-500 text-center">
                      {t("scanToRegister")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Recent Activity List */}
          <div className="px-4 pb-8 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold mb-3 px-1 text-text-dark">
                {t("recentActivity")}
              </h3>
              <button
                onClick={() => router.push("/home/wallets/activity")}
                className="text-sm font-medium text-primary-dark hover:text-primary"
              >
                {t("seeAll")}
              </button>
            </div>

            <div className="space-y-3">
              {directRecentActivity.length > 0 ? (
                directRecentActivity.map((activity) => {
                  const getActivityIcon = (type: string) => {
                    switch (type) {
                      case "DIRECT":
                      case "INDIRECT":
                        return {
                          icon: "attach_money",
                          color: "bg-[#13ec5b]/20",
                          textColor: "text-[#13ec5b]",
                        };
                      case "GROUP":
                        return {
                          icon: "group",
                          color: "bg-blue-500/20",
                          textColor: "text-blue-400",
                        };
                      case "MANAGEMENT":
                        return {
                          icon: "military_tech",
                          color: "bg-purple-500/20",
                          textColor: "text-purple-400",
                        };
                      default:
                        return {
                          icon: "attach_money",
                          color: "bg-[#13ec5b]/20",
                          textColor: "text-[#13ec5b]",
                        };
                    }
                  };

                  const getActivityTitle = (type: string) => {
                    switch (type) {
                      case "DIRECT":
                        return t("directCommission");
                      case "INDIRECT":
                        return t("indirectCommission");
                      case "GROUP":
                        return t("groupCommission");
                      case "MANAGEMENT":
                        return t("managementCommission");
                      default:
                        return t("commissionReceived");
                    }
                  };

                  const getActivitySubtitle = (activity: any) => {
                    const fromInfo = activity.fromUsername
                      ? `${t("fromMember")}: ${activity.fromUsername}`
                      : (activity.fromUserId ? `${t("fromMember")}: ${activity.fromUserId.slice(-6)}` : '');

                    return fromInfo;
                  };

                  const formatTimeAgo = (dateString: string) => {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return t("justNow");
                    if (diffMins < 60) return `${diffMins} ${t("minutesAgo")}`;
                    if (diffHours < 24) return `${diffHours} ${t("hoursAgo")}`;
                    if (diffDays < 7) return `${diffDays} ${t("daysAgo")}`;
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  };

                  const activityStyle = getActivityIcon(activity.type);
                  const isPending = activity.status === "PENDING";
                  const isBlocked = activity.status === "BLOCKED";

                  return (
                    <div
                      key={activity.id}
                      className={`flex items-center justify-between p-3 rounded-lg bg-white border ${isBlocked ? 'border-orange-200 bg-orange-50/30' : 'border-gray-100'} shadow-sm`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full ${isBlocked ? 'bg-orange-100' : activityStyle.color} flex items-center justify-center ${isBlocked ? 'text-orange-600' : activityStyle.textColor}`}
                        >
                          <span className="material-symbols-outlined text-lg">
                            {isBlocked ? 'lock' : activityStyle.icon}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-dark">
                            {getActivityTitle(activity.type)}
                            {isBlocked && (
                              <span className="ml-2 text-[9px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded uppercase">
                                {t("blocked") || "Bị chặn"}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {isBlocked ? (t("reconsumptionRequired") || "Cần tái tiêu dùng") : getActivitySubtitle(activity)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${isBlocked ? "text-orange-600" : (isPending ? "text-yellow-600" : "text-primary-dark")
                            }`}
                        >
                          {isBlocked
                            ? ""
                            : isPending
                              ? `${t("pending")} ${formatPrice(activity.amount)} PV`
                              : `+${formatPrice(activity.amount)} PV`}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {formatTimeAgo(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center p-6 rounded-lg bg-white border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500">
                    {t("noRecentActivity")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
