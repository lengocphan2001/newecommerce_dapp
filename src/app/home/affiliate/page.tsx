"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

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
    packageType?: 'NONE' | 'CTV' | 'NPP';
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

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(num);
  };

  const shortAddress = (address?: string) => {
    if (!address) return "Not Connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getRank = (packageType?: string) => {
    if (packageType === 'NPP') return 'Gold';
    if (packageType === 'CTV') return 'Silver';
    return 'Bronze';
  };

  const getRankProgress = (packageType?: string, purchases?: string) => {
    if (packageType === 'NPP') return 100;
    if (packageType === 'CTV') {
      const amount = parseFloat(purchases || '0');
      return Math.min(100, (amount / 0.001) * 100); // Assuming 0.001 is threshold for NPP
    }
    const amount = parseFloat(purchases || '0');
    return Math.min(100, (amount / 0.0001) * 100); // Assuming 0.0001 is threshold for CTV
  };

  if (loading) {
    return (
      <div className="flex flex-col bg-[#f6f8f6] dark:bg-[#102216] min-h-screen">
        <AppHeader titleKey="navAffiliate" theme="dark" />
        <main className="flex-1 pb-28">
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">{t("affiliateLoading")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !referralInfo) {
    return (
      <div className="flex flex-col bg-[#f6f8f6] dark:bg-[#102216] min-h-screen">
        <AppHeader titleKey="navAffiliate" theme="dark" />
        <main className="flex-1 pb-28">
          <div className="px-4 py-8 text-center">
            <p className="text-red-500">{error || t("affiliateNotFound")}</p>
          </div>
        </main>
      </div>
    );
  }

  const leftVolume = referralInfo.treeStats.left.volume || 0;
  const rightVolume = referralInfo.treeStats.right.volume || 0;
  const pendingRewards = parseFloat(referralInfo.pendingRewards || '0');

  return (
    <div className="flex flex-col bg-[#f6f8f6] dark:bg-[#102216] min-h-screen antialiased">
      {/* Background Pattern Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-pattern"></div>
      
      {/* Content Wrapper */}
      <div className="relative z-10 flex flex-col w-full max-w-md mx-auto min-h-screen bg-transparent overflow-hidden">
        {/* Top App Bar */}
        <AppHeader 
          titleKey="navAffiliate" 
          theme="dark" 
          showMenu={false}
          showActions={false}
          right={
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#13ec5b]/10 border border-[#13ec5b]/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#13ec5b] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#13ec5b]"></span>
                </span>
                <span className="text-xs font-semibold text-[#13ec5b]">SafePal</span>
              </div>
              <button className="flex items-center justify-center rounded-full h-10 w-10 bg-[#162b1e] text-white hover:bg-[#1c3626] transition-colors">
                <span className="material-symbols-outlined text-[#13ec5b]">account_balance_wallet</span>
              </button>
            </div>
          }
        />

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-20">
          {/* Profile & Earnings Section */}
          <div className="px-4 py-2 space-y-4">
            {/* Compact Profile Header */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#162b1e] border border-white/5 shadow-lg">
              <div className="relative">
                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-14 w-14 ring-2 ring-[#13ec5b] ring-offset-2 ring-offset-[#102216] bg-gradient-to-br from-[#13ec5b]/20 to-[#102216]">
                  <div className="h-full w-full rounded-full bg-[#13ec5b]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#13ec5b] text-2xl">person</span>
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#102216] rounded-full p-0.5">
                  <span className="material-symbols-outlined text-[18px] text-[#13ec5b]" title="Verified">verified</span>
                </div>
              </div>
              <div className="flex flex-col justify-center flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold leading-tight text-white">{shortAddress(referralInfo.walletAddress)}</p>
                  <span className="text-xs font-medium text-white/60 bg-white/10 px-2 py-0.5 rounded">
                    {getRank(referralInfo.packageType)} Rank
                  </span>
                </div>
                <p className="text-[#13ec5b] text-sm font-medium">
                  Balance: {formatPrice(referralInfo.bonusCommission || '0')} USDT
                </p>
              </div>
            </div>

            {/* Main Earnings Card */}
            <div className="relative overflow-hidden rounded-xl shadow-lg group">
              <div className="absolute inset-0 bg-cover bg-center z-0 transition-transform duration-500 group-hover:scale-105 bg-gradient-to-br from-[#102216] to-[#162b1e]"></div>
              <div className="relative z-10 p-6 flex flex-col items-center text-center gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Total Earnings</p>
                  <p className="text-white tracking-tight text-4xl font-extrabold">
                    ${formatPrice(referralInfo.bonusCommission || '0')}
                  </p>
                  <p className="text-[#13ec5b] text-sm font-semibold flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    +${formatPrice(pendingRewards)} this week
                  </p>
                </div>
                <div className="w-full h-px bg-white/10"></div>
                <div className="flex justify-between items-center w-full gap-4">
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-white/50">Pending Rewards</span>
                    <span className="text-lg font-bold text-white">${formatPrice(pendingRewards)}</span>
                  </div>
                  <button className="flex items-center gap-2 px-6 py-2.5 bg-[#13ec5b] hover:bg-[#0fd650] text-[#102216] text-sm font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(19,236,91,0.3)]">
                    <span className="material-symbols-outlined text-[20px]">savings</span>
                    Claim
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Binary Network Visualization */}
          <div className="px-4 py-2">
            <h3 className="text-lg font-bold mb-3 px-1 flex items-center justify-between text-gray-900 dark:text-white">
              Network Structure
              <button className="text-xs font-normal text-[#13ec5b] hover:underline">View Full Tree</button>
            </h3>
            <div className="bg-[#162b1e] rounded-xl p-4 border border-white/5 flex flex-col items-center relative overflow-hidden">
              {/* Connecting Lines (SVG) */}
              <svg className="absolute top-10 left-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.3 }} viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M 50 20 L 25 60" fill="none" stroke="#13ec5b" strokeWidth="0.5" vectorEffect="non-scaling-stroke"></path>
                <path d="M 50 20 L 75 60" fill="none" stroke="#13ec5b" strokeWidth="0.5" vectorEffect="non-scaling-stroke"></path>
              </svg>
              
              {/* Top Node (User) */}
              <div className="z-10 flex flex-col items-center mb-8">
                <div className="h-14 w-14 rounded-full bg-[#13ec5b] p-0.5 shadow-[0_0_20px_rgba(19,236,91,0.4)]">
                  <div className="h-full w-full rounded-full bg-[#13ec5b]/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#13ec5b] text-2xl">person</span>
                  </div>
                </div>
                <span className="mt-1 text-xs font-bold text-white">You</span>
              </div>
              
              {/* Bottom Nodes */}
              <div className="flex justify-between w-full px-4 z-10">
                {/* Left Leg */}
                <div className="flex flex-col items-center w-1/2">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-[#1c3626] border-2 border-[#13ec5b] p-0.5 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#13ec5b]">person</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-[#13ec5b] text-[#102216] text-[10px] font-bold px-1.5 rounded-full">L</div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-bold text-white">{referralInfo.treeStats.left.count} Partners</p>
                    <p className="text-[10px] text-white/50">${formatPrice(leftVolume)} Vol</p>
                  </div>
                </div>
                
                {/* Right Leg */}
                <div className="flex flex-col items-center w-1/2">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full bg-[#1c3626] border-2 border-white/20 p-0.5 flex items-center justify-center group cursor-pointer hover:border-[#13ec5b] transition-colors">
                      <span className="material-symbols-outlined text-white/50 group-hover:text-[#13ec5b] transition-colors">person_add</span>
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white/20 text-white text-[10px] font-bold px-1.5 rounded-full">R</div>
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-bold text-white">{referralInfo.treeStats.right.count} Partners</p>
                    <p className="text-[10px] text-white/50">${formatPrice(rightVolume)} Vol</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="px-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#162b1e] p-4 rounded-xl border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#13ec5b] text-xl">military_tech</span>
                  <span className="text-xs font-medium text-white/70">Next Rank</span>
                </div>
                <p className="text-white text-lg font-bold">
                  {referralInfo.packageType === 'CTV' ? 'Gold' : referralInfo.packageType === 'NPP' ? 'Platinum' : 'Silver'}
                </p>
                <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-[#13ec5b] h-1.5 rounded-full" 
                    style={{ width: `${getRankProgress(referralInfo.packageType, referralInfo.accumulatedPurchases)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-right text-white/50 mt-1">
                  {Math.round(getRankProgress(referralInfo.packageType, referralInfo.accumulatedPurchases))}% Complete
                </p>
              </div>
              <div className="bg-[#162b1e] p-4 rounded-xl border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#13ec5b] text-xl">group</span>
                  <span className="text-xs font-medium text-white/70">Active Users</span>
                </div>
                <p className="text-white text-lg font-bold">{referralInfo.treeStats.total} Total</p>
                <p className="text-[10px] text-[#13ec5b] mt-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[10px]">arrow_upward</span>
                  {referralInfo.treeStats.left.count + referralInfo.treeStats.right.count} New today
                </p>
              </div>
            </div>
          </div>

          {/* Referral Tools */}
          <div className="px-4 py-4 mb-2">
            <h3 className="text-lg font-bold mb-3 px-1 text-gray-900 dark:text-white">Referral Tools</h3>
            <div className="bg-[#162b1e] rounded-xl p-4 border border-white/5">
              <div className="flex flex-col gap-4">
                {/* Personal Link */}
                <div className="flex gap-4 items-center">
                  <div className="bg-white p-2 rounded-lg shrink-0">
                    <div className="w-16 h-16 bg-black flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-2xl">qr_code</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-white/50 mb-1 block">Your Personal Link</label>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 pr-1 border border-white/10">
                      <input
                        className="bg-transparent border-none text-white text-sm w-full focus:ring-0 px-2 truncate font-mono"
                        readOnly
                        type="text"
                        value={referralInfo.referralLink}
                      />
                      <button
                        onClick={() => copyToClipboard(referralInfo.referralLink, "personal")}
                        className="bg-[#13ec5b]/20 hover:bg-[#13ec5b]/30 text-[#13ec5b] p-2 rounded-md transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-lg">content_copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Left Branch Link */}
                <div className="flex gap-4 items-center">
                  <div className="bg-white p-2 rounded-lg shrink-0">
                    <div className="w-16 h-16 bg-black flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">L</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-white/50 mb-1 block">Left Branch Link</label>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 pr-1 border border-white/10">
                      <input
                        className="bg-transparent border-none text-white text-sm w-full focus:ring-0 px-2 truncate font-mono"
                        readOnly
                        type="text"
                        value={referralInfo.leftLink}
                      />
                      <button
                        onClick={() => copyToClipboard(referralInfo.leftLink, "left")}
                        className="bg-[#13ec5b]/20 hover:bg-[#13ec5b]/30 text-[#13ec5b] p-2 rounded-md transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-lg">content_copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Branch Link */}
                <div className="flex gap-4 items-center">
                  <div className="bg-white p-2 rounded-lg shrink-0">
                    <div className="w-16 h-16 bg-black flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">R</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-white/50 mb-1 block">Right Branch Link</label>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg p-1 pr-1 border border-white/10">
                      <input
                        className="bg-transparent border-none text-white text-sm w-full focus:ring-0 px-2 truncate font-mono"
                        readOnly
                        type="text"
                        value={referralInfo.rightLink}
                      />
                      <button
                        onClick={() => copyToClipboard(referralInfo.rightLink, "right")}
                        className="bg-[#13ec5b]/20 hover:bg-[#13ec5b]/30 text-[#13ec5b] p-2 rounded-md transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-lg">content_copy</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button className="w-full py-3 rounded-lg bg-[#1c3626] hover:bg-[#23482f] border border-[#13ec5b]/30 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                  <span className="material-symbols-outlined text-[#13ec5b]">share</span>
                  Share on Social Media
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity List */}
          <div className="px-4 pb-8 flex-1">
            <h3 className="text-lg font-bold mb-3 px-1 text-gray-900 dark:text-white">Recent Activity</h3>
            <div className="space-y-3">
              {referralInfo.recentActivity && referralInfo.recentActivity.length > 0 ? (
                referralInfo.recentActivity.map((activity) => {
                  const getActivityIcon = (type: string) => {
                    switch (type) {
                      case 'DIRECT':
                        return { icon: 'attach_money', color: 'bg-[#13ec5b]/20', textColor: 'text-[#13ec5b]' };
                      case 'GROUP':
                        return { icon: 'group', color: 'bg-blue-500/20', textColor: 'text-blue-400' };
                      case 'MANAGEMENT':
                        return { icon: 'military_tech', color: 'bg-purple-500/20', textColor: 'text-purple-400' };
                      default:
                        return { icon: 'attach_money', color: 'bg-[#13ec5b]/20', textColor: 'text-[#13ec5b]' };
                    }
                  };

                  const getActivityTitle = (type: string) => {
                    switch (type) {
                      case 'DIRECT':
                        return 'Direct Commission';
                      case 'GROUP':
                        return 'Group Commission';
                      case 'MANAGEMENT':
                        return 'Management Commission';
                      default:
                        return 'Commission Received';
                    }
                  };

                  const getActivitySubtitle = (type: string) => {
                    switch (type) {
                      case 'DIRECT':
                        return 'From Direct Referral';
                      case 'GROUP':
                        return 'From Binary Network';
                      case 'MANAGEMENT':
                        return 'From Team Performance';
                      default:
                        return 'Commission';
                    }
                  };

                  const formatTimeAgo = (dateString: string) => {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);

                    if (diffMins < 1) return 'Just now';
                    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
                    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  };

                  const activityStyle = getActivityIcon(activity.type);
                  const isPending = activity.status === 'PENDING';

                  return (
                    <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg bg-[#162b1e] border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full ${activityStyle.color} flex items-center justify-center ${activityStyle.textColor}`}>
                          <span className="material-symbols-outlined text-lg">{activityStyle.icon}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{getActivityTitle(activity.type)}</p>
                          <p className="text-xs text-white/50">{getActivitySubtitle(activity.type)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isPending ? 'text-yellow-400' : 'text-[#13ec5b]'}`}>
                          {isPending ? 'Pending' : '+'} ${formatPrice(activity.amount)}
                        </p>
                        <p className="text-[10px] text-white/40">{formatTimeAgo(activity.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center p-6 rounded-lg bg-[#162b1e] border border-white/5">
                  <p className="text-sm text-white/50">No recent activity</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
