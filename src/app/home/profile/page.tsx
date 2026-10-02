"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { invalidateCache } from "@/app/services/apiCache";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [userInfo, setUserInfo] = useState<{
    fullName?: string;
    username?: string;
    avatar?: string;
    packageType?: string;
    rank?: string;
    accumulatedPurchases?: string;
    taxId?: string;
    totalReconsumptionAmount?: string;
  } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [reconsumptionStatus, setReconsumptionStatus] = useState<{
    needsReconsumption?: boolean;
    threshold?: number;
    packageValue?: number;
    currentCommission?: number;
    totalPurchaseAmount?: number;
  } | null>(null);
  const [bankingConfig, setBankingConfig] = useState<any>(null);
  const [rankInfo, setRankInfo] = useState<any>(null);
  const [loadingRank, setLoadingRank] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [kycStatus, setKycStatus] = useState<string | null>(null);

  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxIdInput, setTaxIdInput] = useState("");
  const [updatingTaxId, setUpdatingTaxId] = useState(false);
  const [taxIdMessage, setTaxIdMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadWalletStatus();
    void loadInitialData();
  }, []);

  const getRate = () => {
    return bankingConfig?.usdtPriceVnd > 0 ? bankingConfig.usdtPriceVnd : 25000;
  };

  const loadInitialData = async () => {
    const [profileOutcome, reconOutcome, kycOutcome, bankCfgOutcome, rankOutcome] =
      await Promise.allSettled([
        api.getProfile(),
        api.checkReconsumption(),
        api.getKycStatus(),
        api.getBankingConfig(),
        api.getMyRank(),
      ]);

    if (profileOutcome.status === "fulfilled") {
      const info = profileOutcome.value;
      const localAvatar = localStorage.getItem("userAvatar");
      setUserInfo({
        ...info,
        avatar: info.avatar || localAvatar || undefined,
      });
      if (info && !info.taxId) {
        setShowTaxModal(true);
      }
    } else {
      const e = profileOutcome.reason;
      if (handleAuthError(e, router)) {
        return;
      }
      const savedPhone = localStorage.getItem("userPhone");
      const savedName = localStorage.getItem("userName");
      const savedAvatar = localStorage.getItem("userAvatar");
      setUserInfo({
        fullName: savedName || "Nguyễn Văn A",
        username: savedPhone || "99887722",
        avatar:
          savedAvatar ||
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA",
      });
    }

    if (reconOutcome.status === "fulfilled") {
      setReconsumptionStatus(reconOutcome.value);
    }

    if (kycOutcome.status === "fulfilled") {
      setKycStatus(kycOutcome.value?.status ?? "UNVERIFIED");
    } else {
      setKycStatus("UNVERIFIED");
    }

    if (bankCfgOutcome.status === "fulfilled") {
      setBankingConfig(bankCfgOutcome.value);
    }

    if (rankOutcome.status === "fulfilled") {
      setRankInfo(rankOutcome.value);
    }
    setLoadingRank(false);
  };

  const loadUserProfile = async () => {
    try {
      try {
        const info = await api.getProfile();
        const localAvatar = localStorage.getItem("userAvatar");
        setUserInfo({
          ...info,
          avatar: info.avatar || localAvatar || undefined,
        });
        if (info && !info.taxId) {
          setShowTaxModal(true);
        }
      } catch (e: any) {
        if (handleAuthError(e, router)) {
          return;
        }
        const savedPhone = localStorage.getItem("userPhone");
        const savedName = localStorage.getItem("userName");
        const savedAvatar = localStorage.getItem("userAvatar");
        setUserInfo({
          fullName: savedName || "Nguyễn Văn A",
          username: savedPhone || "99887722",
          avatar:
            savedAvatar ||
            "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA",
        });
      }
    } catch {
      /* ignore */
    }
  };

  const handleSaveTaxId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxIdInput.trim()) return;
    setUpdatingTaxId(true);
    setTaxIdMessage(null);
    try {
      await api.updateProfile({ taxId: taxIdInput.trim() });
      setTaxIdMessage({ type: "success", text: t("taxIdSuccess") });
      setUserInfo(prev => prev ? { ...prev, taxId: taxIdInput.trim() } : null);
      invalidateCache("profile");
      setTimeout(() => {
        setShowTaxModal(false);
        setTaxIdMessage(null);
      }, 1500);
    } catch (err: any) {
      setTaxIdMessage({ type: "error", text: err.message || t("taxIdError") });
    } finally {
      setUpdatingTaxId(false);
    }
  };

  const loadWalletStatus = () => {
    // Check localStorage first
    const storedAddr = localStorage.getItem("walletAddress");
    if (storedAddr) {
      setWalletAddress(storedAddr);
      return;
    }

    // Check window.ethereum
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      if (eth.selectedAddress) {
        setWalletAddress(eth.selectedAddress);
      }
    }
  };

  const handleLogout = () => {
    invalidateCache("referralInfo");
    localStorage.removeItem("token");
    localStorage.removeItem("walletAddress");
    router.push("/");
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert(t("imageTooLarge"));
      return;
    }

    setUploadingAvatar(true);
    try {
      const avatarUrl = await api.uploadAvatar(file);

      // Update local state
      setUserInfo(prev => prev ? { ...prev, avatar: avatarUrl } : null);
      localStorage.setItem("userAvatar", avatarUrl);

      alert(t("avatarUploaded"));

      // Reload profile to get updated info
      await loadUserProfile();
    } catch (error: any) {
      alert(error.message || t("avatarUploadFailed"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const rankStyle = (rank: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      LEADER:   { background: '#eff6ff', color: '#1d4ed8', borderColor: '#93c5fd' },
      MANAGER:  { background: '#f0fdf4', color: '#15803d', borderColor: '#86efac' },
      DIRECTOR: { background: '#fffbeb', color: '#b45309', borderColor: '#fcd34d' },
      DIAMOND:  { background: '#faf5ff', color: '#7e22ce', borderColor: '#d8b4fe' },
    };
    return map[rank] ?? { background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' };
  };

  /** Màu của từng cấp C1..C9, dùng chung với badge trên trang đại lý. */
  const cRankTheme = (rank: string) => {
    const map: Record<string, { badge: string; ring: string; text: string }> = {
      C1: { badge: 'from-amber-600 to-amber-700', ring: 'ring-amber-200', text: 'text-amber-700' },
      C2: { badge: 'from-slate-400 to-slate-500', ring: 'ring-slate-200', text: 'text-slate-600' },
      C3: { badge: 'from-yellow-500 to-amber-500', ring: 'ring-yellow-200', text: 'text-amber-600' },
      C4: { badge: 'from-cyan-500 to-blue-500', ring: 'ring-cyan-200', text: 'text-cyan-700' },
      C5: { badge: 'from-rose-500 to-red-600', ring: 'ring-rose-200', text: 'text-rose-600' },
      C6: { badge: 'from-blue-600 to-indigo-600', ring: 'ring-blue-200', text: 'text-indigo-700' },
      C7: { badge: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-200', text: 'text-emerald-700' },
      C8: { badge: 'from-fuchsia-600 via-purple-600 to-violet-600', ring: 'ring-fuchsia-200', text: 'text-fuchsia-700' },
      C9: { badge: 'from-yellow-500 via-orange-500 to-red-600', ring: 'ring-orange-200', text: 'text-orange-700' },
    };
    return map[rank] || { badge: 'from-slate-500 to-slate-600', ring: 'ring-slate-200', text: 'text-slate-600' };
  };

  const usdToVnd = (usd: number | string | null | undefined) =>
    Math.round((Number(usd) || 0) * getRate()).toLocaleString('vi-VN') + ' VND';

  const calculateCommissionProgress = () => {
    if (!reconsumptionStatus?.threshold || !reconsumptionStatus?.currentCommission) return 0;
    const progress = (reconsumptionStatus.currentCommission / reconsumptionStatus.threshold) * 100;
    return Math.min(progress, 100);
  };

  const getPackageTag = () => {
    const total = Number(userInfo?.accumulatedPurchases) || 0;
    if (total >= 600) {
      return 'Đại lý';
    }
    const type = String(userInfo?.packageType || '').toUpperCase();
    if (type === 'NPP' || type === 'DT') return 'Đối Tác';
    if (type === 'CTV') return 'CTV';
    if (type === 'TV') return 'Thành Viên';
    return type === 'NONE' ? 'User' : type;
  };

  return (
    <div className="bg-white text-slate-900 min-h-screen flex flex-col font-display">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_3px_rgba(16,185,129,0.15)]">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-emerald-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("profileTitle")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-bold text-primary-dark uppercase tracking-wider">Shoplife</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-emerald-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md md:max-w-4xl lg:max-w-5xl mx-auto pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <section className="flex flex-col items-center py-8 px-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-white p-0.5 bg-white overflow-hidden shadow-lg ring-1 ring-slate-100">
              <div
                className="w-full h-full rounded-full bg-center bg-cover"
                style={{ backgroundImage: `url("${userInfo?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA"}")` }}
              >
              </div>
            </div>
            {kycStatus === "APPROVED" ? (
              <div className="absolute bottom-1 right-1 flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 border-[3px] border-white shadow-md" title={t("verified")}>
                <span className="material-symbols-outlined text-white text-lg">verified</span>
              </div>
            ) : (
              <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm"></div>
            )}
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary hover:bg-primary-dark text-white shadow-lg cursor-pointer transition-all active:scale-95"
            >
              {uploadingAvatar ? (
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-base">photo_camera</span>
              )}
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              disabled={uploadingAvatar}
            />
          </div>
          <div className="mt-4 text-center w-full">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center justify-center gap-2 flex-wrap">
              {userInfo?.fullName || "Nguyễn Văn A"}
              {kycStatus === "APPROVED" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs font-semibold shadow-sm" title={t("verified")}>
                  <span className="material-symbols-outlined text-sm">verified</span>
                  {t("verified")}
                </span>
              )}
            </h2>
            <div className="flex flex-col items-center gap-2 mt-1">
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <span className="text-slate-500 text-sm font-medium">Binary ID: {userInfo?.username || "99887722"}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  (Number(userInfo?.accumulatedPurchases) || 0) >= 600
                    ? 'bg-amber-500 text-white'
                    : 'bg-primary/10 text-primary-dark'
                }`}>
                  {getPackageTag()}
                </span>
              </div>
              {rankInfo?.isRanked ? (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${cRankTheme(rankInfo.rank).badge} text-white font-bold text-xs uppercase tracking-wider shadow-md`}
                >
                  <span className="material-symbols-outlined text-sm leading-none">workspace_premium</span>
                  {rankInfo.rank}
                </div>
              ) : userInfo?.rank && userInfo.rank !== 'NONE' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold text-xs uppercase tracking-wider shadow-sm"
                  style={rankStyle(userInfo.rank)}>
                  <span className="material-symbols-outlined text-sm leading-none">workspace_premium</span>
                  {userInfo.rank}
                </div>
              ) : null}
            </div>

            {/* Buy package section - hidden for now (Packages CTV, NPP, TV)
            <div className="mt-5 w-full max-w-sm mx-auto">
              {purchaseError && (
                <p className="text-sm font-medium text-red-600 mb-3 text-center">{purchaseError}</p>
              )}
              {myPurchases.filter((p) => p.status === "pending").length > 0 && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-sm text-amber-900 text-center font-medium">
                  {t("packagesPendingLabel")}: {myPurchases.filter((p) => p.status === "pending").map((p) => `${p.package?.name ?? "Package"} — $${Number(p.amount).toLocaleString()}`).join("; ")}. {t("packagesPendingWaitAdmin")}
                </div>
              )}
              {packagesLoading ? (
                <p className="text-base text-slate-600 text-center font-medium">{t("packagesLoading")}</p>
              ) : packages.length === 0 ? (
                <p className="text-base text-slate-600 text-center font-medium">{t("packagesNoneAvailable")}</p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex flex-col gap-2 p-4 rounded-xl bg-white border-2 border-slate-200 shadow-md text-center"
                    >
                      <p className="font-bold text-slate-900 text-sm leading-tight truncate" title={pkg.name}>{pkg.name}</p>
                      <p className="text-xs font-medium text-slate-700">{pkg.code}</p>
                      <button
                        type="button"
                        onClick={() => handleBuyPackage(pkg)}
                        disabled={!!purchasingId}
                        className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
                      >
                        {purchasingId === pkg.id ? "..." : t("packagesBuy")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            */}

            {/* Cấp bậc đại lý C1..C9: phần chính của màn hình profile */}
            {loadingRank ? (
              <div className="w-full max-w-sm mx-auto mt-6 rounded-2xl border-2 border-slate-100 p-4 animate-pulse">
                <div className="h-5 w-32 bg-slate-100 rounded mb-3"></div>
                <div className="h-20 bg-slate-100 rounded-xl"></div>
              </div>
            ) : rankInfo ? (
              <div className="w-full max-w-sm mx-auto mt-6 space-y-4 text-left">
                {/* Thẻ cấp bậc */}
                <div
                  className={`rounded-2xl p-5 text-white shadow-lg bg-gradient-to-br ${
                    rankInfo.isRanked ? cRankTheme(rankInfo.rank).badge : 'from-slate-500 to-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                        {t("rankCurrentLabel")}
                      </p>
                      <p className="text-3xl font-black leading-tight">
                        {rankInfo.isRanked ? rankInfo.rank : t("rankUnranked")}
                      </p>
                      <p className="text-xs font-medium text-white/80 mt-0.5">
                        {rankInfo.rankLabel} • {t("rankMonthLabel")} {rankInfo.month}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-4xl text-white/80">
                      workspace_premium
                    </span>
                  </div>

                  {rankInfo.isManualRank && (
                    <p className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
                      <span className="material-symbols-outlined text-xs leading-none">admin_panel_settings</span>
                      {t("rankManualBadge")}
                    </p>
                  )}
                </div>

                {/* Điều kiện lên cấp tiếp theo */}
                <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-800">{t("rankNextTitle")}</p>
                    {rankInfo.nextRank && (
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r ${cRankTheme(rankInfo.nextRank).badge} text-white`}
                      >
                        {rankInfo.nextRank}
                      </span>
                    )}
                  </div>

                  {!rankInfo.isRanked && rankInfo.daiLyCondition && !rankInfo.daiLyCondition.satisfied && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>{t("rankDailyCondition")}</span>
                        <span>
                          {usdToVnd(rankInfo.daiLyCondition.actual)} / {usdToVnd(rankInfo.daiLyCondition.required)}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              ((Number(rankInfo.daiLyCondition.actual) || 0) /
                                (Number(rankInfo.daiLyCondition.required) || 1)) * 100,
                            )}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {rankInfo.nextQualification ? (
                    <div className="space-y-3">
                      {rankInfo.nextQualification.requirements.map((req: any) => {
                        const percent = Math.min(
                          100,
                          ((Number(req.actualCount) || 0) / (Number(req.requiredCount) || 1)) * 100,
                        );
                        return (
                          <div key={`${req.requiredRank}-${req.requiredCount}`}>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span>
                                {t("rankRequirementLine")} {req.requiredRankLabel}
                              </span>
                              <span className={req.satisfied ? 'text-emerald-600' : 'text-slate-500'}>
                                {req.actualCount}/{req.requiredCount}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  req.satisfied ? 'bg-emerald-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-emerald-600">{t("rankMaxReached")}</p>
                  )}

                  <p className="text-[10px] text-slate-400 font-medium mt-3">{t("rankThisMonthNote")}</p>
                </div>
              </div>
            ) : null}

            {/* Commission Progress Bar - dùng ternary để tránh render số 0 khi threshold = 0 */}
            {reconsumptionStatus && reconsumptionStatus.threshold ? (
              <div className="w-full max-w-sm mx-auto mt-6 bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-md">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-slate-800">{t("maxCommission")}</span>
                  <span className="text-sm font-bold text-blue-700">
                    {reconsumptionStatus.currentCommission ? Math.round(reconsumptionStatus.currentCommission * getRate()).toLocaleString('vi-VN') : "0"} / {Math.round(reconsumptionStatus.threshold * getRate()).toLocaleString('vi-VN')} VND
                  </span>
                </div>
                <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${calculateCommissionProgress()}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-100 rounded-lg p-3 border-2 border-slate-200">
                    <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">{t("reconsumptionTimesLabel")}</p>
                    <p className="text-base font-black text-slate-900">
                      {(() => {
                        const totalRecon = Number(userInfo?.accumulatedPurchases) || 0;
                        const pkgType = (userInfo?.packageType || "").toUpperCase();
                        let reqAmount = 40; // Default requirement in USD for CTV
                        if (pkgType === "NPP" || pkgType === "DT") {
                          reqAmount = 400; // Requirement in USD for NPP/DT
                        }
                        const reconsumptionTimes = Math.floor(totalRecon / reqAmount);
                        return `${reconsumptionTimes} ${t("timesUnit")}`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-3 border-2 border-slate-200">
                    <p className="text-[11px] font-bold text-slate-700 uppercase mb-1">{t("reconsumptionAmountLabel")}</p>
                    <p className="text-base font-black text-slate-900">
                      {(() => {
                        const totalRecon = Number(userInfo?.accumulatedPurchases) || 0;
                        const totalReconVnd = Math.round(totalRecon * getRate());
                        return `${totalReconVnd.toLocaleString("vi-VN")} VND`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}


            
          </div>
        </section>

        <section className="px-4 space-y-4">
          {/* Email verification */}
          

          <div className="premium-card overflow-hidden">
          <button
              onClick={() => router.push('/home/profile/kyc')}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
                <span className="material-symbols-outlined text-xl font-medium">badge</span>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-800">{t("kycTitle")}</p>
                <p className="text-xs text-slate-400">{t("kycDesc")}</p>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <button
              onClick={() => router.push('/home/profile/edit')}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#135bec]/10 text-[#135bec]">
                <span className="material-symbols-outlined text-xl font-medium">person</span>
              </div>
              <span className="flex-1 font-medium text-slate-800 text-left">{t("editProfile")}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <div className="mx-4 border-t border-slate-50"></div>
            <button
              onClick={() => router.push('/home/profile/address')}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-primary-dark">
                <span className="material-symbols-outlined text-xl font-medium">location_on</span>
              </div>
              <span className="flex-1 font-medium text-slate-800 text-left">{t("shippingAddress")}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <div className="mx-4 border-t border-slate-50"></div>
            <button
              onClick={() => router.push('/home/orders')}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
                <span className="material-symbols-outlined text-xl font-medium">history</span>
              </div>
              <span className="flex-1 font-medium text-slate-800 text-left">{t("orderHistoryNav")}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
          </div>

          <div className="premium-card overflow-hidden">
            <button className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600">
                <span className="material-symbols-outlined text-xl font-medium">shield</span>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-800">{t("security")}</p>
                <p className="text-xs text-slate-400">{t("security2FA")}</p>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <div className="mx-4 border-t border-slate-50"></div>
            
            <div className="mx-4 border-t border-slate-50"></div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-red-50 transition-colors text-red-500"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-xl font-medium">logout</span>
              </div>
              <span className="flex-1 font-semibold text-left">{t("logout")}</span>
            </button>
          </div>
          <div className="premium-card overflow-hidden p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">{t("identityVerification")}</p>
            <p className="text-xs text-slate-500 mb-3">{t("identityVerificationDesc")}</p>
            <button
              type="button"
              onClick={() => router.push("/home/profile/kyc")}
              className="text-sm py-2.5 px-4 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
            >
              {t("goToKyc")}
            </button>
          </div>
        </section>
        </div>

        <div className="mt-8 text-center px-4">
          <p className="text-[11px] text-slate-400 font-medium tracking-wide">Shoplife DAPP v2.1.0 • BINARY ECOSYSTEM</p>
        </div>
      </main>

      {showTaxModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-center">
              <div className="size-16 rounded-full bg-violet-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-violet-600">receipt_long</span>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-800">{t("taxIdModalTitle")}</h3>
              <p className="text-slate-500 text-sm">{t("taxIdModalDesc")}</p>
            </div>
            <form onSubmit={handleSaveTaxId} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">{t("taxIdLabel")}</label>
                <input
                  type="text"
                  required
                  value={taxIdInput}
                  onChange={(e) => setTaxIdInput(e.target.value)}
                  placeholder={t("taxIdPlaceholder")}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition text-sm font-medium"
                />
              </div>
              {taxIdMessage && (
                <p className={`text-sm font-semibold ${taxIdMessage.type === "success" ? "text-green-500" : "text-red-500"}`}>
                  {taxIdMessage.text}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaxModal(false)}
                  disabled={updatingTaxId}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm font-semibold"
                >
                  {t("taxIdCancel")}
                </button>
                <button
                  type="submit"
                  disabled={updatingTaxId || !taxIdInput.trim()}
                  className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 font-semibold"
                >
                  {updatingTaxId ? (
                    <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : null}
                  {t("taxIdSubmit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
