"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

interface TreeNode {
  id: string;
  username: string;
  fullName: string;
  avatar?: string;
  packageType: 'NONE' | 'CTV' | 'NPP';
  position?: 'left' | 'right';
  leftBranchTotal?: number;
  rightBranchTotal?: number;
  totalPurchaseAmount?: number;
  createdAt?: string;
}

export default function BinaryTreeView() {
  const { t } = useI18n();
  const router = useRouter();
  const [treeData, setTreeData] = useState<{
    left: { members: TreeNode[]; volume: number; count: number };
    right: { members: TreeNode[]; volume: number; count: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTreeData();
  }, []);

  const fetchTreeData = async () => {
    try {
      setLoading(true);
      const info = await api.getReferralInfo();
      
      // Format members data
      const leftMembers = (info.treeStats?.left?.members || []).map((member: any) => ({
        id: member.id || '',
        username: member.username || '',
        fullName: member.fullName || '',
        avatar: member.avatar,
        packageType: member.packageType || 'NONE',
        position: 'left' as const,
        leftBranchTotal: typeof member.leftBranchTotal === 'number' ? member.leftBranchTotal : parseFloat(member.leftBranchTotal || '0') || 0,
        rightBranchTotal: typeof member.rightBranchTotal === 'number' ? member.rightBranchTotal : parseFloat(member.rightBranchTotal || '0') || 0,
        totalPurchaseAmount: typeof member.totalPurchaseAmount === 'number' ? member.totalPurchaseAmount : parseFloat(member.totalPurchaseAmount || '0') || 0,
        createdAt: member.createdAt,
      }));

      const rightMembers = (info.treeStats?.right?.members || []).map((member: any) => ({
        id: member.id || '',
        username: member.username || '',
        fullName: member.fullName || '',
        avatar: member.avatar,
        packageType: member.packageType || 'NONE',
        position: 'right' as const,
        leftBranchTotal: typeof member.leftBranchTotal === 'number' ? member.leftBranchTotal : parseFloat(member.leftBranchTotal || '0') || 0,
        rightBranchTotal: typeof member.rightBranchTotal === 'number' ? member.rightBranchTotal : parseFloat(member.rightBranchTotal || '0') || 0,
        totalPurchaseAmount: typeof member.totalPurchaseAmount === 'number' ? member.totalPurchaseAmount : parseFloat(member.totalPurchaseAmount || '0') || 0,
        createdAt: member.createdAt,
      }));

      setTreeData({
        left: {
          members: leftMembers,
          volume: typeof info.treeStats?.left?.volume === 'number' ? info.treeStats.left.volume : parseFloat(info.treeStats?.left?.volume || '0') || 0,
          count: info.treeStats?.left?.count || 0,
        },
        right: {
          members: rightMembers,
          volume: typeof info.treeStats?.right?.volume === 'number' ? info.treeStats.right.volume : parseFloat(info.treeStats?.right?.volume || '0') || 0,
          count: info.treeStats?.right?.count || 0,
        },
      });
    } catch (err: any) {
      if (handleAuthError(err, router)) {
        return;
      }
      setError(err.message || "Failed to load tree data");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    // Search logic can be implemented later
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatVolume = (volume: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(volume);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-gray">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
          <p className="text-gray-500">{t("affiliateLoading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-gray">
        <div className="text-center p-4">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            {t("back") || "Quay lại"}
          </button>
        </div>
      </div>
    );
  }

  if (!treeData) {
    return null;
  }

  return (
    <div className="flex flex-col bg-background-gray min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-[0_1px_3px_rgba(37,99,235,0.05)]">
        <button 
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-blue-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("networkStructure")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/10 border border-blue-600/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">SafePal</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-blue-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      {/* Search Section */}
      <div className="w-full max-w-lg mx-auto px-4 pt-4">
        <label className="flex flex-col w-full">
          <div className="flex w-full items-stretch rounded-xl h-12 bg-white shadow-sm border border-gray-100">
            <div className="flex items-center justify-center pl-4 text-gray-400">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              className="form-input flex-1 border-none bg-transparent focus:ring-0 text-base placeholder:text-gray-400"
              placeholder={t("searchMemberId")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-4 text-primary font-semibold text-sm"
            >
              {t("search")}
            </button>
          </div>
        </label>
      </div>

      {/* Main Content - Two Column Layout */}
      <main className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 gap-4 pb-32">
        <div className="grid grid-cols-2 gap-4">
          {/* Left Branch */}
          <div className="flex flex-col gap-3">
            {/* Left Branch Summary Card */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                {t("affiliateLeftBranchLabel")}
              </p>
              <div className="flex flex-col">
                <span className="text-base font-bold text-text-dark">
                  ${formatVolume(treeData.left.volume)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {treeData.left.count} {t("members")}
                </span>
              </div>
            </div>

            {/* Left Branch Members List */}
            <div className="flex flex-col gap-2">
              {treeData.left.members.map((member) => (
                <div
                  key={member.id}
                  className="bg-white p-2 rounded-xl border border-gray-100 flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-sm">person</span>
                  </div>
                  <div className="min-w-0 overflow-hidden flex-1">
                    <p className="text-[11px] font-bold truncate text-text-dark">
                      {member.fullName || member.username}
                    </p>
                    <p className="text-[9px] text-gray-400">{t("memberId")} {member.username}</p>
                    {member.totalPurchaseAmount !== undefined && member.totalPurchaseAmount > 0 && (
                      <p className="text-[9px] text-primary-dark font-semibold">
                        ${formatPrice(member.totalPurchaseAmount)}
                      </p>
                    )}
                    {member.createdAt && (
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        {formatDate(member.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Add Member Button */}
              <button className="bg-blue-50 border-2 border-dashed border-primary rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-primary text-xl">add_circle</span>
                <span className="text-[10px] font-bold text-primary uppercase">{t("addMember")}</span>
              </button>
            </div>
          </div>

          {/* Right Branch */}
          <div className="flex flex-col gap-3">
            {/* Right Branch Summary Card */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                {t("affiliateRightBranchLabel")}
              </p>
              <div className="flex flex-col">
                <span className="text-base font-bold text-text-dark">
                  ${formatVolume(treeData.right.volume)}
                </span>
                <span className="text-[10px] text-gray-500">
                  {treeData.right.count} {t("members")}
                </span>
              </div>
            </div>

            {/* Right Branch Members List */}
            <div className="flex flex-col gap-2">
              {treeData.right.members.map((member) => (
                <div
                  key={member.id}
                  className="bg-white p-2 rounded-xl border border-gray-100 flex items-center gap-2"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-sm">person</span>
                  </div>
                  <div className="min-w-0 overflow-hidden flex-1">
                    <p className="text-[11px] font-bold truncate text-text-dark">
                      {member.fullName || member.username}
                    </p>
                    <p className="text-[9px] text-gray-400">{t("memberId")} {member.username}</p>
                    {member.totalPurchaseAmount !== undefined && member.totalPurchaseAmount > 0 && (
                      <p className="text-[9px] text-primary-dark font-semibold">
                        ${formatPrice(member.totalPurchaseAmount)}
                      </p>
                    )}
                    {member.createdAt && (
                      <p className="text-[9px] text-gray-400 mt-0.5">
                        {formatDate(member.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Add Member Button */}
              <button className="bg-blue-50 border-2 border-dashed border-primary rounded-xl p-3 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform">
                <span className="material-symbols-outlined text-primary text-xl">add_circle</span>
                <span className="text-[10px] font-bold text-primary uppercase">{t("addMember")}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
