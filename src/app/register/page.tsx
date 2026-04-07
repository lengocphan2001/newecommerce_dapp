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
  const [isFirstUser, setIsFirstUser] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    phoneNumber: "",
    email: "",
    referralUser: "",
    leg: "",
  });

  const generateUsername = () => {
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    let s = "";
    for (let i = 0; i < 3; i++) s += letters[Math.floor(Math.random() * letters.length)];
    for (let i = 0; i < 3; i++) s += numbers[Math.floor(Math.random() * numbers.length)];
    return s;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/home");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");
    const leg = urlParams.get("leg");
    setFormData((prev) => ({
      ...prev,
      ...(refCode ? { referralUser: refCode, leg: (leg === "left" || leg === "right") ? leg : prev.leg } : {}),
      username: prev.username || generateUsername(),
    }));

    api.isFirstUser()
      .then((r: { isFirstUser?: boolean }) => setIsFirstUser(!!r?.isFirstUser))
      .catch(() => setIsFirstUser(false))
      .finally(() => setIsChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const username = formData.username.trim();
    if (!username || username.length < 3) {
      setError("Tên đăng nhập tối thiểu 3 ký tự (chữ và số)");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      setError("Tên đăng nhập chỉ được chứa chữ và số");
      return;
    }
    if (!formData.password) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }
    if (formData.password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setError("Vui lòng nhập số điện thoại");
      return;
    }
    const email = formData.email.trim().toLowerCase();
    if (!email) {
      setError("Vui lòng nhập email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Email không hợp lệ");
      return;
    }
    if (!isFirstUser && !formData.referralUser?.trim()) {
      setError("Vui lòng nhập mã giới thiệu");
      return;
    }
    if (!isFirstUser && !formData.leg) {
      setError(t("selectSide"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.usernameRegister({
        username,
        password: formData.password,
        fullName: username,
        phoneNumber: formData.phoneNumber.trim(),
        email,
        referralUser: formData.referralUser?.trim() || undefined,
        leg: (formData.leg === "left" || formData.leg === "right") ? formData.leg : undefined,
      });

      if (result.token) {
        localStorage.setItem("token", result.token);
      }
      router.push("/home");
    } catch (err: any) {
      const msg = typeof err.message === "string" ? err.message : "";
      const isUsernameTaken = /username\s+already\s+exists/i.test(msg);
      if (isUsernameTaken) {
        setFormData((prev) => ({ ...prev, username: generateUsername() }));
        setError("Tên đăng nhập đã tồn tại. Đã tạo mã mới, vui lòng thử lại.");
      } else {
        setError(msg || "Đăng ký thất bại. Vui lòng thử lại.");
      }
      setIsLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{t("registerAccount")}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {t("completeInfoToCreateAccount")}
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Đã có tài khoản?{" "}
            <a href="/" className="font-medium text-blue-600 hover:text-blue-700">
              Đăng nhập
            </a>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              {t("username")} <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[^a-zA-Z0-9]/g, "") })}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="abc123"
                minLength={3}
                maxLength={20}
              />
              <button
                type="button"
                onClick={() => setFormData({ ...formData, username: generateUsername() })}
                className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Tạo mới
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Chữ và số, 3–20 ký tự. Bấm &quot;Tạo mới&quot; để tạo ngẫu nhiên.
            </p>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-zinc-700">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Tối thiểu 6 ký tự"
              minLength={6}
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-zinc-700">
              Xác nhận mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nhập lại mật khẩu"
            />
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

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="you@example.com"
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

          {/* Leg Selection */}
          {(!isFirstUser || formData.referralUser) && (
            <div>
              <label htmlFor="leg" className="mb-1 block text-sm font-medium text-zinc-700">
                {t("selectSide")} <span className="text-red-500">*</span>
              </label>
              <select
                id="leg"
                value={formData.leg}
                onChange={(e) => setFormData({ ...formData, leg: e.target.value })}
                className="w-full appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%236b7280%22%20d%3D%22M6%209L1%204h10z%22/%3E%3C/svg%3E')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat px-4 py-2.5 pr-10 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                required={!isFirstUser}
              >
                <option value="" className="text-zinc-400">{t("selectSide")}</option>
                <option value="left" className="text-zinc-900">{t("affiliateLeftBranchLabel")}</option>
                <option value="right" className="text-zinc-900">{t("affiliateRightBranchLabel")}</option>
              </select>
            </div>
          )}

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
