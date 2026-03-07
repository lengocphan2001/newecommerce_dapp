"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
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
    accumulatedPurchases?: string;
    bonusCommission?: string;
    maxCommission?: string;
    totalReconsumptionAmount?: string;
    emailVerified?: boolean;
    treeStats?: {
      left: { count: number; total: number };
      right: { count: number; total: number };
    };
  } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [reconsumptionStatus, setReconsumptionStatus] = useState<{
    needsReconsumption?: boolean;
    threshold?: number;
    packageValue?: number;
    currentCommission?: number;
  } | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [packages, setPackages] = useState<Array<{ id: string; name: string; code: string; price: number; description?: string; directCommissionRate: number; groupCommissionRate: number; managementRateF1: number }>>([]);
  const [myPurchases, setMyPurchases] = useState<Array<{ id: string; packageId: string; amount: number; status: string; package?: { name: string; code: string } }>>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState("");

  useEffect(() => {
    loadUserProfile();
    loadWalletStatus();
    loadReconsumptionStatus();
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      setPackagesLoading(true);
      const [list, purchases] = await Promise.all([
        api.getActivePackages(),
        api.getMyPackagePurchases(),
      ]);
      setPackages(Array.isArray(list) ? list : []);
      setMyPurchases(Array.isArray(purchases) ? purchases : []);
    } catch (_) {
      setPackages([]);
      setMyPurchases([]);
    } finally {
      setPackagesLoading(false);
    }
  };

  const handleBuyPackage = async (pkg: { id: string; name: string; code: string; price: number }) => {
    try {
      setPurchasingId(pkg.id);
      setPurchaseError("");
      const purchase = await api.purchasePackage(pkg.id);
      const purchaseId = purchase?.id ?? (purchase as any)?.data?.id;
      const amount = Number(pkg.price);
      if (purchaseId && amount > 0) {
        router.push(
          `/home/package-checkout?purchaseId=${encodeURIComponent(purchaseId)}&amount=${amount}&packageName=${encodeURIComponent(pkg.name)}`
        );
      } else {
        await loadPackages();
      }
    } catch (err: any) {
      if (handleAuthError(err, router)) return;
      setPurchaseError(err.message || "Failed to request purchase");
    } finally {
      setPurchasingId(null);
    }
  };

  const loadReconsumptionStatus = async () => {
    try {
      const status = await api.checkReconsumption();
      setReconsumptionStatus(status);
    } catch (error) {
      // Silently fail
    }
  };

  const loadUserProfile = async () => {
    try {
      // Try to get info from API
      if (typeof api !== 'undefined') {
        try {
          const info = await api.getReferralInfo();
          // Get local avatar as fallback
          const localAvatar = localStorage.getItem("userAvatar");
          setUserInfo({
            ...info,
            avatar: info.avatar || localAvatar
          });
        } catch (e: any) {
          // Check if it's an authentication error and redirect
          if (handleAuthError(e, router)) {
            return; // Redirect is happening
          }
          // Fallback to local storage or defaults
          const savedPhone = localStorage.getItem("userPhone");
          const savedName = localStorage.getItem("userName");
          const savedAvatar = localStorage.getItem("userAvatar");
          setUserInfo({
            fullName: savedName || "Nguyễn Văn A",
            username: savedPhone || "99887722",
            avatar: savedAvatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA"
          });
        }
      }
    } catch (err) {
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
    localStorage.removeItem("token");
    localStorage.removeItem("walletAddress");
    router.push("/");
  };

  const handleSendVerification = () => {
    setSendingVerify(true);
    setVerifyMessage("");
    setShowCodeInput(false);
    api.sendVerificationEmail()
      .then((res: { message?: string; code?: string }) => {
        setVerifyMessage(res.message || "");
        if (res.code) setVerifyMessage((m) => `${m} Mã: ${res.code}`);
        setShowCodeInput(true);
        loadUserProfile();
      })
      .catch((err: Error) => setVerifyMessage(err.message || "Failed"))
      .finally(() => setSendingVerify(false));
  };

  const handleVerifyCode = () => {
    if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
      setVerifyMessage(t("enter6DigitCode"));
      return;
    }
    setVerifying(true);
    setVerifyMessage("");
    api.verifyEmailByCode(verificationCode)
      .then(() => {
        setVerifyMessage("");
        setVerificationCode("");
        setShowCodeInput(false);
        loadUserProfile();
      })
      .catch((err: Error) => setVerifyMessage(err.message || "Failed"))
      .finally(() => setVerifying(false));
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

  const calculateReconsumptionCycles = () => {
    if (!reconsumptionStatus?.threshold || !reconsumptionStatus?.currentCommission) return 0;
    return Math.floor(reconsumptionStatus.currentCommission / reconsumptionStatus.threshold);
  };

  const calculateCommissionProgress = () => {
    if (!reconsumptionStatus?.threshold || !reconsumptionStatus?.currentCommission) return 0;
    const progress = (reconsumptionStatus.currentCommission / reconsumptionStatus.threshold) * 100;
    return Math.min(progress, 100);
  };

  return (
    <div className="bg-white text-slate-900 min-h-screen flex flex-col font-display">
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_3px_rgba(240,185,11,0.15)]">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-yellow-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("profileTitle")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-bold text-primary-dark uppercase tracking-wider">BinanMall</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-blue-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto pb-32">
        <section className="flex flex-col items-center py-8 px-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-white p-0.5 bg-white overflow-hidden shadow-lg ring-1 ring-slate-100">
              <div
                className="w-full h-full rounded-full bg-center bg-cover"
                style={{ backgroundImage: `url("${userInfo?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA"}")` }}
              >
              </div>
            </div>
            <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm"></div>
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
            <h2 className="text-2xl font-bold text-slate-900">{userInfo?.fullName || "Nguyễn Văn A"}</h2>
            <div className="flex flex-col items-center gap-2 mt-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm font-medium">Binary ID: {userInfo?.username || "99887722"}</span>
                <span className="bg-yellow-50 text-primary-dark text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {userInfo?.packageType === 'NONE' ? 'User' : userInfo?.packageType}
                </span>
              </div>
            </div>

            {/* Packages (CTV, NPP, TV) - 3 columns */}
            <div className="mt-4 w-full max-w-sm mx-auto">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-base text-slate-500">redeem</span>
                {t("packagesSectionTitle")}
              </p>
              {purchaseError && (
                <p className="text-xs text-red-600 mb-2 text-center">{purchaseError}</p>
              )}
              {myPurchases.filter((p) => p.status === "pending").length > 0 && (
                <div className="mb-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 text-center">
                  {t("packagesPendingLabel")}: {myPurchases.filter((p) => p.status === "pending").map((p) => `${p.package?.name ?? "Package"} — $${Number(p.amount).toLocaleString()}`).join("; ")}. {t("packagesPendingWaitAdmin")}
                </div>
              )}
              {packagesLoading ? (
                <p className="text-sm text-slate-500 text-center">{t("packagesLoading")}</p>
              ) : packages.length === 0 ? (
                <p className="text-sm text-slate-500 text-center">{t("packagesNoneAvailable")}</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm text-center"
                    >
                      <p className="font-semibold text-slate-900 text-xs leading-tight truncate" title={pkg.name}>{pkg.name}</p>
                      <p className="text-[10px] text-slate-500">{pkg.code}</p>
                      <button
                        type="button"
                        onClick={() => handleBuyPackage(pkg)}
                        disabled={!!purchasingId}
                        className="w-full py-1 rounded-lg bg-primary text-white text-[10px] font-medium hover:bg-primary-dark disabled:opacity-50"
                      >
                        {purchasingId === pkg.id ? "..." : t("packagesBuy")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Commission Progress Bar */}
            {reconsumptionStatus && reconsumptionStatus.threshold && (
              <div className="w-full max-w-sm mx-auto mt-6 bg-white rounded-2xl p-4 border border-purple-100 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-700">{t("maxCommission")}</span>
                  <span className="text-xs font-semibold text-primary">
                    ${reconsumptionStatus.currentCommission ? reconsumptionStatus.currentCommission.toLocaleString('en-US', { maximumFractionDigits: 4 }) : "0.00"} / ${reconsumptionStatus.threshold}
                  </span>
                </div>
                <div className="h-2 bg-purple-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${calculateCommissionProgress()}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase mb-0.5">Số lần tái tiêu dùng</p>
                    <p className="text-sm font-black text-slate-900">{calculateReconsumptionCycles()} lần</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                    <p className="text-[10px] font-bold text-purple-600 uppercase mb-0.5">Đã tái tiêu dùng</p>
                    <p className="text-sm font-black text-slate-900">${userInfo?.totalReconsumptionAmount ? parseFloat(userInfo.totalReconsumptionAmount).toLocaleString('en-US', { maximumFractionDigits: 4 }) : "0.00"}</p>
                  </div>
                </div>
              </div>
            )}


            
          </div>
        </section>

        <section className="px-4 space-y-4">
          {/* Email verification */}
          

          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
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
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-50 text-primary-dark">
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

          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
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
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-4">
            <p className="text-sm font-semibold text-slate-800 mb-3">{t("emailVerification")}</p>
            {userInfo?.emailVerified === true ? (
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {t("emailVerified")}
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">{t("emailNotVerified")}</p>
                {!showCodeInput ? (
                  <button
                    type="button"
                    onClick={handleSendVerification}
                    disabled={sendingVerify}
                    className="text-sm py-2.5 px-4 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                  >
                    {sendingVerify ? "..." : t("sendVerificationEmail")}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">{t("enterVerificationCode")}</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center text-lg font-mono tracking-[0.4em]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifying || verificationCode.length !== 6}
                        className="flex-1 text-sm py-2.5 px-4 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                      >
                        {verifying ? "..." : t("verifyCode")}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendVerification}
                        disabled={sendingVerify}
                        className="text-sm py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50"
                      >
                        {t("resendCode")}
                      </button>
                    </div>
                  </div>
                )}
                {verifyMessage && (
                  <p className="text-xs text-slate-600 mt-3 break-all">{verifyMessage}</p>
                )}
              </>
            )}
          </div>
        </section>

        <div className="mt-8 text-center px-4">
          <p className="text-[11px] text-slate-400 font-medium tracking-wide">BINANMALL DAPP v2.1.0 • BINARY ECOSYSTEM</p>
        </div>
      </main>
    </div>
  );
}
