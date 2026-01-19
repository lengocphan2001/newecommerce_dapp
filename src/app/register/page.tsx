"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { api } from "../services/api";
import { useI18n } from "../i18n/I18nProvider";

function RegisterForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isFirstUser, setIsFirstUser] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    country: "",
    address: "",
    phoneNumber: "",
    email: "",
    referralUser: "",
  });

  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState("");

  useEffect(() => {
    // Get wallet address and chainId from localStorage (not URL for security)
    const address = localStorage.getItem("walletAddress") || "";
    const chainIdParam = localStorage.getItem("chainId") || "";

    if (!address) {
      router.push("/safepal");
      return;
    }

    setWalletAddress(address);
    setChainId(chainIdParam);

    // Get referral code and leg from URL parameter
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get("ref");
      const leg = urlParams.get("leg"); // left or right
      if (refCode) {
        setFormData((prev) => ({ ...prev, referralUser: refCode }));
        // Store leg in localStorage to send with registration
        if (leg === "left" || leg === "right") {
          localStorage.setItem("referralLeg", leg);
        } else {
          // Clear any existing leg if not specified
          localStorage.removeItem("referralLeg");
        }
      }
    }

    // Check if user is already registered and if this is first user
    let countdownTimer: NodeJS.Timeout | null = null;
    
    const checkUserRegistration = async () => {
      try {
        setIsChecking(true);
        const [checkResult, firstUserResult] = await Promise.all([
          api.checkWallet(address),
          api.isFirstUser().catch(() => ({ isFirstUser: false, count: 0 })), // Fallback if API fails
        ]);
        
        if (checkResult.exists) {
          setIsAlreadyRegistered(true);
          // Start countdown
          let remaining = 5;
          countdownTimer = setInterval(() => {
            remaining--;
            setCountdown(remaining);
            if (remaining <= 0) {
              if (countdownTimer) clearInterval(countdownTimer);
              // Auto login and redirect
              api.walletLogin(address).then((result) => {
                if (result.token) {
                  localStorage.setItem("token", result.token);
                }
                router.push("/home");
              }).catch(() => {
                router.push("/");
              });
            }
          }, 1000);
        } else {
          setIsAlreadyRegistered(false);
          setIsFirstUser(firstUserResult.isFirstUser || false);
        }
      } catch (err: any) {
        console.error("Error checking wallet:", err);
        // If check fails, allow registration to proceed
        setIsAlreadyRegistered(false);
        setIsFirstUser(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkUserRegistration();
    
    // Cleanup timer on unmount
    return () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
      }
    };
  }, [router]);

  const countries = [
    { code: "US", name: "United States", dialCode: "+1" },
    { code: "GB", name: "United Kingdom", dialCode: "+44" },
    { code: "SG", name: "Singapore", dialCode: "+65" },
    { code: "TH", name: "Thailand", dialCode: "+66" },
    { code: "KR", name: "South Korea", dialCode: "+82" },
    { code: "VN", name: "Vietnam", dialCode: "+84" },
    { code: "CN", name: "China", dialCode: "+86" },
    { code: "JP", name: "Japan", dialCode: "+81" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.username.trim()) {
      setError("Vui lòng nhập tên người dùng");
      return;
    }
    if (!formData.fullName.trim()) {
      setError("Vui lòng nhập họ tên");
      return;
    }
    if (!formData.country) {
      setError("Vui lòng chọn quốc gia");
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setError("Vui lòng nhập số điện thoại");
      return;
    }
    if (!formData.email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Email không hợp lệ");
      return;
    }
    // Referral code is required unless this is the first user
    if (!isFirstUser && (!formData.referralUser || !formData.referralUser.trim())) {
      setError("Vui lòng nhập mã giới thiệu");
      return;
    }

    if (!walletAddress || !chainId) {
      setError("Thông tin ví không hợp lệ");
      return;
    }

    setIsLoading(true);

    try {
      // Get leg from localStorage if exists
      const leg = localStorage.getItem("referralLeg") as 'left' | 'right' | null;
      
      const result = await api.walletRegister({
        walletAddress,
        chainId,
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        country: formData.country,
        address: formData.address.trim() || undefined,
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        referralUser: formData.referralUser.trim() || undefined,
        leg: leg || undefined,
      });
      
      // Clear leg from localStorage after registration
      if (leg) {
        localStorage.removeItem("referralLeg");
      }

      // Store token
      if (result.token) {
        localStorage.setItem("token", result.token);
      }
      localStorage.setItem("walletAddress", walletAddress);

      // Redirect to home
      router.push("/home");
    } catch (err: any) {
      setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
      setIsLoading(false);
    }
  };

  const chainIdDec = chainId ? String(Number(BigInt(chainId))) : "";

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 mx-auto mb-4"></div>
          <p className="text-sm text-zinc-600">{t("checkingRegistration")}</p>
        </div>
      </div>
    );
  }

  // Show already registered message with countdown
  if (isAlreadyRegistered) {
    return (
      <div className="min-h-screen bg-zinc-50 py-8 px-4">
        <div className="mx-auto max-w-md">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-6 text-center">
            <div className="mb-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-blue-600 text-3xl">check_circle</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900 mb-2">{t("alreadyRegistered")}</h2>
              <p className="text-sm text-zinc-600 mb-4">
                {t("alreadyRegisteredMessage")}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-sm text-zinc-600 mb-2">{t("redirectingToLogin")}</p>
              <p className="text-2xl font-bold text-blue-600">{countdown}</p>
              <p className="text-xs text-zinc-500 mt-1">{t("seconds")}</p>
            </div>
            <button
              onClick={() => {
                api.walletLogin(walletAddress).then((result) => {
                  if (result.token) {
                    localStorage.setItem("token", result.token);
                  }
                  router.push("/home");
                }).catch(() => {
                  router.push("/");
                });
              }}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {t("goToLoginNow")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{t("registerAccount")}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {t("completeInfoToCreateAccount")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet Info (Read-only) */}
          <div className="rounded-xl bg-blue-50 p-4">
            <div className="mb-2 text-xs font-medium text-blue-900">{t("walletInfoAutoFill")}</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">{t("walletAddressLabel")}</span>
                <span className="font-mono text-xs text-zinc-900">
                  {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">{t("chainIdLabel")}</span>
                <span className="font-mono text-xs text-zinc-900">
                  {chainIdDec || chainId || "-"}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              {t("walletInfoCannotChange")}
            </p>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("username")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t("enterUsername")}
              required
            />
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("fullName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t("enterFullName")}
              required
            />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="country" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("country")} <span className="text-red-500">*</span>
            </label>
            <select
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M6%209L1%204h10z%22/%3E%3C/svg%3E')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat px-4 py-2.5 pr-10 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            >
              <option value="" className="text-zinc-400">{t("selectCountry")}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code} className="text-zinc-900">
                  {country.name} ({country.dialCode})
                </option>
              ))}
            </select>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("phoneNumber")} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t("enterPhoneNumber")}
              required
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("address")}
            </label>
            <input
              type="text"
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t("enterAddress")}
            />
          </div>

          

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("email")} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={t("email")}
              required
            />
          </div>

          {/* Referral User */}
          <div>
            <label htmlFor="referralUser" className="mb-1 block text-sm font-medium text-zinc-700">
              {t("referralCode")} {!isFirstUser && <span className="text-red-500">*</span>}
              {isFirstUser && <span className="text-xs text-zinc-500 ml-2">(Tùy chọn - Bạn sẽ là root user)</span>}
            </label>
            <input
              type="text"
              id="referralUser"
              value={formData.referralUser}
              onChange={(e) => setFormData({ ...formData, referralUser: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={isFirstUser ? t("enterReferralCode") + " (Tùy chọn)" : t("enterReferralCode")}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {t("registering")}
              </span>
            ) : (
              t("register")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900"></div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
