"use client";

import React, { useEffect, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";

export default function AffiliatePage() {
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
      setError(err.message || "Không thể tải thông tin giới thiệu");
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
            <p className="text-zinc-500">Đang tải...</p>
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
            <p className="text-red-500">{error || "Không tìm thấy thông tin giới thiệu"}</p>
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
          {/* Referral Code Card */}
          <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Mã giới thiệu của bạn
            </h2>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Mã giới thiệu (Username)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralInfo.referralCode}
                  readOnly
                  className="flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-mono text-zinc-900"
                />
                <button
                  onClick={() => copyToClipboard(referralInfo.referralCode, "code")}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {copied === "code" ? "Đã copy!" : "Sao chép"}
                </button>
              </div>
            </div>
          </div>

          {/* Binary Tree Links */}
          <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Link giới thiệu nhánh
            </h2>
            
            {/* Left Link */}
            <div className="mb-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  L
                </span>
                Link nhánh trái
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
                  {copied === "left" ? "Đã copy!" : "Sao chép"}
                </button>
              </div>
            </div>

            {/* Right Link */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
                  R
                </span>
                Link nhánh phải
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
                  {copied === "right" ? "Đã copy!" : "Sao chép"}
                </button>
              </div>
            </div>
          </div>

          {/* Binary Tree Stats */}
          <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Thống kê nhóm
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-blue-50 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {referralInfo.treeStats.left.count}
                </p>
                <p className="mt-1 text-xs text-blue-700">Nhánh trái</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-4 text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {referralInfo.treeStats.right.count}
                </p>
                <p className="mt-1 text-xs text-orange-700">Nhánh phải</p>
              </div>
              <div className="rounded-lg bg-green-50 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {referralInfo.treeStats.total}
                </p>
                <p className="mt-1 text-xs text-green-700">Tổng cộng</p>
              </div>
            </div>
          </div>

          {/* Downline Members */}
          {(referralInfo.treeStats.left.members.length > 0 || referralInfo.treeStats.right.members.length > 0) && (
            <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                Thành viên nhóm
              </h2>
              
              {/* Left Members */}
              {referralInfo.treeStats.left.members.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                      L
                    </span>
                    Nhánh trái ({referralInfo.treeStats.left.count})
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
                    Nhánh phải ({referralInfo.treeStats.right.count})
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
              Hướng dẫn sử dụng
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>
                  Chia sẻ link giới thiệu hoặc mã giới thiệu cho người bạn muốn giới thiệu
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>
                  Khi người được giới thiệu đăng ký và mua gói, bạn sẽ nhận được hoa hồng
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">•</span>
                <span>
                  Hoa hồng sẽ được tính tự động khi có giao dịch phát sinh
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

