"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

export default function F1ListPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [f1List, setF1List] = useState<Array<{
    id: string;
    username: string | null;
    fullName: string;
    email: string;
    packageType: string;
    totalPurchaseAmount: number;
    createdAt: string;
    directReferralCount: number;
    binaryTeam?: 'left' | 'right' | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const list = await api.getF1List();
        setF1List(list);
      } catch (err: any) {
        if (handleAuthError(err, router)) return;
        setError(err.message || t("affiliateError"));
        setF1List([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, t]);

  const formatDateSimple = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const goToAffiliate = () => router.push("/home/affiliate");

  if (loading) {
    return (
      <div className="flex flex-col bg-background-gray">
        <AppHeader title={t("f1ListTitle")} showBack={true} onBack={goToAffiliate} />
        <main className="flex-1 px-4 py-8 text-center">
          <p className="text-gray-500">{t("affiliateLoading")}</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col bg-background-gray">
        <AppHeader title={t("f1ListTitle")} showBack={true} onBack={goToAffiliate} />
        <main className="flex-1 px-4 py-8 text-center">
          <p className="text-red-500">{error}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background-gray antialiased">
      <div className="relative z-10 flex flex-col w-full max-w-md mx-auto bg-transparent overflow-hidden">
        <AppHeader title={t("f1ListTitle")} showBack={true} onBack={goToAffiliate} />
        <div
          className="flex-1 overflow-y-auto bg-white pb-24"
          style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="px-4 py-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <h4 className="text-sm font-bold text-text-dark mb-3">
                {t("f1ListTitle")} ({f1List.length})
              </h4>
              {f1List.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">{t("f1Empty")}</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm border-collapse">
                     <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-600">
                        <th className="py-2 px-1 font-medium">{t("username")}</th>
                        <th className="py-2 px-1 font-medium hidden sm:table-cell">{t("fullName")}</th>
                        <th className="py-2 px-1 font-medium">{t("rank")}</th>
                        <th className="py-2 px-1 font-medium">{t("f1Team")}</th>
                        <th className="py-2 px-1 font-medium text-center">{t("f1DirectReferrals")}</th>
                        <th className="py-2 px-1 font-medium hidden sm:table-cell">{t("f1JoinedDate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f1List.map((f1) => (
                        <tr key={f1.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="py-2.5 px-1 font-medium text-text-dark">{f1.username || "-"}</td>
                          <td className="py-2.5 px-1 text-gray-600 hidden sm:table-cell truncate max-w-[120px]">{f1.fullName || "-"}</td>
                          <td className="py-2.5 px-1">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              (Number(f1.totalPurchaseAmount) || 0) >= 600
                                ? 'bg-amber-500 text-white'
                                : 'text-gray-600 bg-gray-100'
                            }`}>
                              {Number(f1.totalPurchaseAmount) >= 600
                                ? 'Đại lý'
                                : f1.packageType === 'NPP' || f1.packageType === 'DT'
                                ? 'Đối Tác'
                                : f1.packageType === 'CTV'
                                ? 'CTV'
                                : f1.packageType === 'TV'
                                ? 'Thành Viên'
                                : f1.packageType || 'NONE'
                              }
                            </span>
                          </td>
                          <td className="py-2.5 px-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              f1.binaryTeam === 'left'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : f1.binaryTeam === 'right'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-gray-50 text-gray-500 border border-gray-200'
                            }`}>
                              {f1.binaryTeam === 'left'
                                ? (lang === 'vi' ? 'Đại lý A' : lang === 'ko' ? '대리점 A' : 'Agency A')
                                : f1.binaryTeam === 'right'
                                ? (lang === 'vi' ? 'Đại lý B' : lang === 'ko' ? '대리점 B' : 'Agency B')
                                : '-'
                              }
                            </span>
                          </td>
                          <td className="py-2.5 px-1 text-center">
                            <span className="inline-flex items-center justify-center min-w-[1.75rem] font-semibold text-primary-dark bg-primary/10 rounded-full text-xs">
                              {f1.directReferralCount}
                            </span>
                          </td>
                          <td className="py-2.5 px-1 text-gray-500 text-xs hidden sm:table-cell" suppressHydrationWarning>
                            {formatDateSimple(f1.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
