"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";
import { QRCodeSVG } from "qrcode.react";

export default function AffiliatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [referralInfo, setReferralInfo] = useState<{
    referralCode: string;
    referralLink: string;
    leftLink: string;
    rightLink: string;
    username: string;
    fullName: string;
    treeStats: {
      left: { count: number; members: any[]; volume?: number };
      right: { count: number; members: any[]; volume?: number };
      total: number;
    };
    accumulatedPurchases?: string;
    bonusCommission?: string;
    packageType?: "NONE" | "CTV" | "NPP";
    totalReconsumptionAmount?: string;
    walletAddress?: string;
    pendingRewards?: string;
    recentActivity?: Array<{
      id: string;
      type: string;
      amount: string;
      status: string;
      createdAt: string;
      fromUserId?: string;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<"left" | "right" | null>(null);
  const [commissionConfigs, setCommissionConfigs] = useState<{
    CTV?: { packageValue: number };
    NPP?: { packageValue: number };
  }>({});

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
      maximumFractionDigits: 6,
    }).format(num);
  };

  const formatVolume = (volume: string | number) => {
    const num = typeof volume === "string" ? parseFloat(volume) : volume;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(num);
  };

  const getMaxCommission = (packageType?: string) => {
    // Based on reconsumption threshold
    if (packageType === "NPP") return 0.01; // $1600 in production
    if (packageType === "CTV") return 0.001; // $160 in production
    return 0; // NONE package cannot receive commission
  };

  const shortAddress = (address?: string) => {
    if (!address) return t("notConnected");
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRank = (packageType?: string) => {
    if (packageType === "NPP") return "NPP";
    if (packageType === "CTV") return "CTV";
    return "NONE";
  };

  const getNextRank = (packageType?: string) => {
    if (packageType === "CTV") return "NPP";
    if (packageType === "NONE") return "CTV";
    return "NPP"; // NPP is highest, so no next rank
  };

  const getRankProgress = (packageType?: string, purchases?: string) => {
    if (packageType === "NPP") return 100;
    const amount = parseFloat(purchases || "0");
    if (packageType === "CTV") {
      const nppPackageValue = commissionConfigs.NPP?.packageValue || 0.001;
      return Math.min(100, (amount / nppPackageValue) * 100);
    }
    // NONE -> CTV
    const ctvPackageValue = commissionConfigs.CTV?.packageValue || 0.0001;
    return Math.min(100, (amount / ctvPackageValue) * 100);
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
    const leftMembers = referralInfo.treeStats.left.members || [];
    const rightMembers = referralInfo.treeStats.right.members || [];
    const allMembers = [...leftMembers, ...rightMembers];
    return allMembers.filter(
      (member: any) => member.createdAt && isToday(member.createdAt)
    ).length;
  }, [referralInfo]);

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
  const maxCommission = getMaxCommission(referralInfo.packageType);
  const receivedCommission =
    typeof referralInfo.bonusCommission === "string"
      ? parseFloat(referralInfo.bonusCommission || "0")
      : referralInfo.bonusCommission || 0;

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
                  SafePalMall
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
          {/* Profile & Earnings Section */}
          <div className="px-4 py-4 space-y-4">
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
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {t("rank")} : {getRank(referralInfo.packageType)}
                  </span>
                </div>
                <p className="text-primary-dark text-sm font-medium">
                  {t("balance")}:{" "}
                  {formatPrice(referralInfo.bonusCommission || "0")} USDT
                </p>
              </div>
            </div>
          </div>

          {/* Maximum Commission & Branch Totals */}
          <div className="px-4 py-2">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm mb-3">
              <h4 className="text-sm font-bold text-text-dark mb-3">
                {t("commission")} & {t("networkStructure")}
              </h4>
              <div className="space-y-3">
                {/* Total Commission Can Receive */}
                {referralInfo.packageType !== "NONE" && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-primary text-xl">
                        account_balance_wallet
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {t("totalCommissionCanReceive")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {t("received")}
                        </span>
                        <span className="text-lg font-bold text-primary-dark">
                          ${formatVolume(receivedCommission)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {t("maximum")}
                        </span>
                        <span className="text-lg font-bold text-primary-dark">
                          ${formatVolume(maxCommission)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {/* Branch Totals */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-blue-800">
                        {t("affiliateLeftBranchLabel")}
                      </span>
                    </div>
                    <p className="text-base font-bold text-text-dark">
                      ${formatVolume(leftVolume)}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-green-800">
                        {t("affiliateRightBranchLabel")}
                      </span>
                    </div>
                    <p className="text-base font-bold text-text-dark">
                      ${formatVolume(rightVolume)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Binary Network Visualization */}
          <div className="px-4 py-2">
            <h3 className="text-lg font-bold mb-3 px-1 flex items-center justify-between text-text-dark">
              {t("networkStructure")}
              <button
                onClick={() => router.push("/home/affiliate/tree")}
                className="text-xs font-normal text-primary-dark hover:underline"
              >
                {t("viewFullTree")}
              </button>
            </h3>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col items-center relative overflow-hidden">
              {/* Connecting Lines (SVG) */}
              <svg
                className="absolute top-10 left-0 w-full h-full pointer-events-none z-0"
                style={{ opacity: 0.3 }}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M 50 20 L 25 60"
                  fill="none"
                  stroke="#13ec5b"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                ></path>
                <path
                  d="M 50 20 L 75 60"
                  fill="none"
                  stroke="#13ec5b"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                ></path>
              </svg>

              {/* Top Node (User) */}
              <div className="z-10 flex flex-col items-center mb-8">
                <div className="h-14 w-14 rounded-full bg-primary p-0.5 shadow-md shadow-primary/30">
                  <div className="h-full w-full rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-2xl">
                      person
                    </span>
                  </div>
                </div>
                <span className="mt-1 text-xs font-bold text-text-dark">
                  {t("you")}
                </span>
              </div>

              {/* Bottom Nodes */}
              <div className="flex justify-between w-full px-4 z-10">
                {/* Left Leg */}
                <div className="flex flex-col items-center w-1/2">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-gray-50 border-2 border-primary p-0.5 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">
                        person
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[10px] font-bold px-1.5 rounded-full">
                      L
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-bold text-text-dark">
                      {referralInfo.treeStats.left.count} {t("partners")}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      ${formatVolume(leftVolume)} {t("vol")}
                    </p>
                  </div>
                </div>

                {/* Right Leg */}
                <div className="flex flex-col items-center w-1/2">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-gray-50 border-2 border-gray-200 p-0.5 flex items-center justify-center group cursor-pointer hover:border-primary transition-colors">
                      <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">
                        person_add
                      </span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 rounded-full">
                      R
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-bold text-text-dark">
                      {referralInfo.treeStats.right.count} {t("partners")}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      ${formatVolume(rightVolume)} {t("vol")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="px-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-primary-dark text-xl">
                    military_tech
                  </span>
                  <span className="text-xs font-medium text-gray-600">
                    {t("nextRank")}
                  </span>
                </div>
                <p className="text-text-dark text-lg font-bold">
                  {getNextRank(referralInfo.packageType)}
                </p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-primary h-1.5 rounded-full"
                    style={{
                      width: `${getRankProgress(
                        referralInfo.packageType,
                        referralInfo.accumulatedPurchases
                      )}%`,
                    }}
                  ></div>
                </div>
                <p className="text-[10px] text-right text-gray-500 mt-1">
                  {Math.round(
                    getRankProgress(
                      referralInfo.packageType,
                      referralInfo.accumulatedPurchases
                    )
                  )}
                  % {t("complete")}
                </p>
              </div>
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
          </div>

          {/* Referral Tools */}
          <div className="px-4 py-4 mb-2">
            <h3 className="text-lg font-bold mb-3 px-1 text-text-dark">
              {t("referralTools")}
            </h3>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex flex-col gap-4">
                {/* Left Branch Link */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 min-w-0">
                      <label className="text-xs text-gray-600 mb-1 block">
                        {t("leftBranchLink")}
                      </label>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 pr-1 border border-gray-200">
                        <input
                          className="bg-transparent border-none text-text-dark text-sm w-full focus:ring-0 px-2 truncate font-mono"
                          readOnly
                          type="text"
                          value={referralInfo.leftLink}
                        />
                        <button
                          type="button"
                          onClick={(e) =>
                            copyToClipboard(referralInfo.leftLink, "left", e)
                          }
                          className="bg-primary/10 hover:bg-primary/20 text-primary-dark p-2 rounded-md transition-colors shrink-0 relative z-10"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {copied === "left" ? "check" : "content_copy"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setShowQR(showQR === "left" ? null : "left")
                          }
                          className="bg-primary/10 hover:bg-primary/20 text-primary-dark p-2 rounded-md transition-colors shrink-0 relative z-10"
                        >
                          <span className="material-symbols-outlined text-lg">
                            qr_code
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {showQR === "left" && (
                    <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <QRCodeSVG value={referralInfo.leftLink} size={200} />
                      <p className="text-xs text-gray-500 text-center">
                        {t("scanToRegister") || "Quét để đăng ký"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Branch Link */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 min-w-0">
                      <label className="text-xs text-gray-600 mb-1 block">
                        {t("rightBranchLink")}
                      </label>
                      <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 pr-1 border border-gray-200">
                        <input
                          className="bg-transparent border-none text-text-dark text-sm w-full focus:ring-0 px-2 truncate font-mono"
                          readOnly
                          type="text"
                          value={referralInfo.rightLink}
                        />
                        <button
                          type="button"
                          onClick={(e) =>
                            copyToClipboard(referralInfo.rightLink, "right", e)
                          }
                          className="bg-primary/10 hover:bg-primary/20 text-primary-dark p-2 rounded-md transition-colors shrink-0 relative z-10"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {copied === "right" ? "check" : "content_copy"}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setShowQR(showQR === "right" ? null : "right")
                          }
                          className="bg-primary/10 hover:bg-primary/20 text-primary-dark p-2 rounded-md transition-colors shrink-0 relative z-10"
                        >
                          <span className="material-symbols-outlined text-lg">
                            qr_code
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                  {showQR === "right" && (
                    <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <QRCodeSVG value={referralInfo.rightLink} size={200} />
                      <p className="text-xs text-gray-500 text-center">
                        {t("scanToRegister") || "Quét để đăng ký"}
                      </p>
                    </div>
                  )}
                </div>
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
              {referralInfo.recentActivity &&
              referralInfo.recentActivity.length > 0 ? (
                referralInfo.recentActivity.map((activity) => {
                  const getActivityIcon = (type: string) => {
                    switch (type) {
                      case "DIRECT":
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
                      case "GROUP":
                        return t("groupCommission");
                      case "MANAGEMENT":
                        return t("managementCommission");
                      default:
                        return t("commissionReceived");
                    }
                  };

                  const getActivitySubtitle = (type: string) => {
                    switch (type) {
                      case "DIRECT":
                        return t("fromDirectReferral");
                      case "GROUP":
                        return t("fromBinaryNetwork");
                      case "MANAGEMENT":
                        return t("fromTeamPerformance");
                      default:
                        return t("commissionReceived");
                    }
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

                  return (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full ${activityStyle.color} flex items-center justify-center ${activityStyle.textColor}`}
                        >
                          <span className="material-symbols-outlined text-lg">
                            {activityStyle.icon}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-dark">
                            {getActivityTitle(activity.type)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {getActivitySubtitle(activity.type)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            isPending ? "text-yellow-600" : "text-primary-dark"
                          }`}
                        >
                          {isPending ? t("pending") : "+"} $
                          {formatPrice(activity.amount)}
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
