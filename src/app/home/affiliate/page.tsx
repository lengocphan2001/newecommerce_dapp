"use client";

import React, { useEffect, useState, useMemo } from "react";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function AffiliatePage() {
  const { t } = useI18n();
  const [referralInfo, setReferralInfo] = useState<{
    referralCode: string;
    referralLink: string;
    leftLink: string;
    rightLink: string;
    username: string;
    fullName: string;
    treeStats: {
      left: { count: number; members: any[] };
      right: { count: number; members: any[] };
      total: number;
    };
    accumulatedPurchases?: string;
    bonusCommission?: string;
    packageType?: 'NONE' | 'CTV' | 'NPP';
    totalReconsumptionAmount?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Check if reconsumption is required (điều kiện để nhận hoa hồng)
  // Notification chỉ hiển thị khi:
  // 1. Đã đạt ngưỡng hoa hồng (threshold)
  // 2. VÀ chưa đủ tái tiêu dùng để tiếp tục nhận hoa hồng
  const reconsumptionInfo = useMemo(() => {
    if (!referralInfo || !referralInfo.packageType || referralInfo.packageType === 'NONE') {
      return null;
    }

    const commissionAmount = parseFloat(referralInfo.bonusCommission || '0');
    const reconsumptionAmount = parseFloat(referralInfo.totalReconsumptionAmount || '0');
    
    let threshold = 0;
    let required = 0;
    
    if (referralInfo.packageType === 'CTV') {
      threshold = 0.001; // TEST: giảm từ 160 - Ngưỡng hoa hồng để cần tái tiêu dùng (khi nhận được $0.001)
      required = 0.0001; // TEST: giảm từ 40 - Số tiền tái tiêu dùng cần thiết mỗi chu kỳ ($0.0001)
    } else if (referralInfo.packageType === 'NPP') {
      threshold = 0.01; // TEST: giảm từ 1600 - Ngưỡng hoa hồng để cần tái tiêu dùng (khi nhận được $0.01)
      required = 0.001; // TEST: giảm từ 400 - Số tiền tái tiêu dùng cần thiết mỗi chu kỳ ($0.001)
    } else {
      return null;
    }

    // Debug log
    console.log('[Reconsumption Check]', {
      packageType: referralInfo.packageType,
      commissionAmount,
      threshold,
      required,
      reconsumptionAmount,
      hasReachedThreshold: commissionAmount >= threshold,
    });

    // Kiểm tra xem đã đạt ngưỡng hoa hồng chưa
    // Chỉ hiển thị notification khi đã đạt ngưỡng VÀ chưa đủ tái tiêu dùng
    if (commissionAmount >= threshold) {
      // Đã đạt ngưỡng, kiểm tra tái tiêu dùng
      const cycles = Math.floor(commissionAmount / threshold);
      const requiredReconsumption = cycles * required;
      const hasEnoughReconsumption = reconsumptionAmount >= requiredReconsumption;
      
      console.log('[Reconsumption Check] Details:', {
        cycles,
        requiredReconsumption,
        hasEnoughReconsumption,
        willShowNotification: !hasEnoughReconsumption,
      });
      
      // Chỉ hiển thị notification nếu CHƯA đủ tái tiêu dùng
      if (!hasEnoughReconsumption) {
        return {
          needsReconsumption: true,
          requiredAmount: requiredReconsumption,
          currentAmount: reconsumptionAmount,
          missingAmount: Math.max(0, requiredReconsumption - reconsumptionAmount),
          packageType: referralInfo.packageType,
        };
      }
      
      // Đã đủ tái tiêu dùng, không cần hiển thị notification
      return null;
    }
    
    // Chưa đạt ngưỡng, không cần tái tiêu dùng → không hiển thị notification
    console.log('[Reconsumption Check] Not reached threshold yet');
    return null;
  }, [referralInfo]);

  useEffect(() => {
    fetchReferralInfo();
  }, []);

  const fetchReferralInfo = async () => {
    try {
      setLoading(true);
      const info = await api.getReferralInfo();
      setReferralInfo(info);
    } catch (err: any) {
      setError(err.message || t("affiliateError"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col bg-zinc-50">
        <AppHeader titleKey="navAffiliate" />
        <main className="flex-1 pb-28">
          <div className="mx-auto max-w-2xl px-4 py-8 text-center">
            <p className="text-zinc-500">{t("affiliateLoading")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !referralInfo) {
    return (
      <div className="flex flex-col bg-zinc-50">
        <AppHeader titleKey="navAffiliate" />
        <main className="flex-1 pb-28">
          <div className="mx-auto max-w-2xl px-4 py-8 text-center">
            <p className="text-red-500">{error || t("affiliateNotFound")}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navAffiliate" />
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {/* Reconsumption Warning - Điều kiện để nhận hoa hồng */}
          {reconsumptionInfo?.needsReconsumption && (
            <div className="mb-4 rounded-xl border-2 border-orange-300 bg-orange-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-orange-600 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-orange-900 mb-1">
                    {t("affiliateReconsumptionWarning")}
                  </p>
                  <p className="text-sm text-orange-800 mb-2">
                    {reconsumptionInfo.packageType === 'CTV' 
                      ? t("affiliateReconsumptionRequiredCTV")
                      : t("affiliateReconsumptionRequiredNPP")}
                  </p>
                  <div className="mt-2 rounded-lg bg-orange-100 px-3 py-2">
                    <p className="text-xs text-orange-900">
                      <span className="font-semibold">{t("affiliateReconsumptionCurrent")}:</span> ${reconsumptionInfo.currentAmount.toFixed(2)} / ${reconsumptionInfo.requiredAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-orange-800 mt-1">
                      <span className="font-semibold">{t("affiliateReconsumptionMissing")}:</span> ${reconsumptionInfo.missingAmount.toFixed(2)} {t("affiliateReconsumptionRequired")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accumulated Purchases & Bonus Commission */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <span className="text-sm font-medium opacity-90">
                  {t("affiliateAccumulatedPurchases")}
                </span>
              </div>
              <p className="text-2xl font-bold">
                ${referralInfo.accumulatedPurchases || "0.00"}
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-green-600 p-6 text-white shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium opacity-90">
                  {t("affiliateBonusCommission")}
                </span>
              </div>
              <p className="text-2xl font-bold">
                ${referralInfo.bonusCommission || "0.00"}
              </p>
            </div>
          </div>

          {/* Binary Tree Links */}
          <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              {t("affiliateBranchLinksTitle")}
            </h2>
            
            {/* Left Link */}
            <div className="mb-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  L
                </span>
                {t("affiliateLeftBranch")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralInfo.leftLink}
                  readOnly
                  className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-900"
                />
                <button
                  onClick={() => copyToClipboard(referralInfo.leftLink, "left")}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {copied === "left" ? t("affiliateCopied") : t("affiliateCopy")}
                </button>
              </div>
            </div>

            {/* Right Link */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  R
                </span>
                {t("affiliateRightBranch")}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralInfo.rightLink}
                  readOnly
                  className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-900"
                />
                <button
                  onClick={() => copyToClipboard(referralInfo.rightLink, "right")}
                  className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-700"
                >
                  {copied === "right" ? t("affiliateCopied") : t("affiliateCopy")}
                </button>
              </div>
            </div>
          </div>

          {/* Binary Tree Stats */}
          <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              {t("affiliateGroupStatsTitle")}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {referralInfo.treeStats.left.count}
                </p>
                <p className="mt-1 text-xs text-blue-700">{t("affiliateLeftBranchLabel")}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {referralInfo.treeStats.right.count}
                </p>
                <p className="mt-1 text-xs text-orange-700">{t("affiliateRightBranchLabel")}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {referralInfo.treeStats.total}
                </p>
                <p className="mt-1 text-xs text-green-700">{t("affiliateTotal")}</p>
              </div>
            </div>
          </div>

          {/* Downline Members */}
          {(referralInfo.treeStats.left.members.length > 0 || referralInfo.treeStats.right.members.length > 0) && (
            <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                {t("affiliateMembersTitle")}
              </h2>
              
              {/* Left Members */}
              {referralInfo.treeStats.left.members.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      L
                    </span>
                    {t("affiliateLeftBranchLabel")} ({referralInfo.treeStats.left.count})
                  </h3>
                  <div className="space-y-2">
                    {referralInfo.treeStats.left.members.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {member.fullName || member.username}
                          </p>
                          <p className="text-xs text-zinc-500">@{member.username}</p>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {new Date(member.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Right Members */}
              {referralInfo.treeStats.right.members.length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                      R
                    </span>
                    {t("affiliateRightBranchLabel")} ({referralInfo.treeStats.right.count})
                  </h3>
                  <div className="space-y-2">
                    {referralInfo.treeStats.right.members.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-zinc-900">
                            {member.fullName || member.username}
                          </p>
                          <p className="text-xs text-zinc-500">@{member.username}</p>
                        </div>
                        <span className="text-xs text-zinc-500">
                          {new Date(member.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="rounded-xl bg-blue-50 p-6">
            <h3 className="mb-3 text-base font-semibold text-blue-900">
              {t("affiliateInstructionsTitle")}
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{t("affiliateInstruction1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{t("affiliateInstruction2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>{t("affiliateInstruction3")}</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

