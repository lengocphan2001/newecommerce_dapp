"use client";

import React, { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import LanguageSelect from "@/app/components/LanguageSelect";
import { api } from "@/app/services/api";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.replace("/home");
    }
  }, [router]);

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpStep, setOtpStep] = useState<"credentials" | "otp">("credentials");
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [otpInfo, setOtpInfo] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [forgotMode, setForgotMode] = useState<boolean>(false);
  const [forgotIdentifier, setForgotIdentifier] = useState<string>("");
  const [forgotMessage, setForgotMessage] = useState<string>("");

  const sendLoginOtp = useCallback(async () => {
    setError("");
    const u = username.trim();
    if (!u) {
      setError(t("username") ? `${t("username")} is required` : "Username is required");
      return;
    }
    if (!password || password.length < 6) {
      setError(
        t("passwordLabel")
          ? `${t("passwordLabel")} must be at least 6 characters`
          : "Password must be at least 6 characters"
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.usernameLogin(u, password);
      if (res.token && res.requiresEmailOtp === false) {
        localStorage.setItem("token", res.token);
        if (res.user?.walletAddress) {
          try {
            localStorage.setItem("walletAddress", res.user.walletAddress);
          } catch {
            // ignore
          }
        }
        router.push("/home");
        return;
      }
      if (res.requiresEmailOtp) {
        setMaskedEmail(res.maskedEmail || "");
        setOtpInfo(
          [res.message, res.code ? `(Dev: mã ${res.code})` : ""].filter(Boolean).join(" ")
        );
        setOtpStep("otp");
        setOtpCode("");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [username, password, t, router]);

  const handleUsernameLogin = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      await sendLoginOtp();
    },
    [sendLoginOtp]
  );

  const handleVerifyOtp = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      setError("");
      const u = username.trim();
      const c = otpCode.trim();
      if (!/^\d{6}$/.test(c)) {
        setError("Vui lòng nhập đúng mã 6 chữ số từ email.");
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await api.usernameLoginVerify(u, password, c);
        if (res.token) {
          localStorage.setItem("token", res.token);
          if (res.user?.walletAddress) {
            try {
              localStorage.setItem("walletAddress", res.user.walletAddress);
            } catch {
              // ignore
            }
          }
          router.push("/home");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Xác thực thất bại");
      } finally {
        setIsSubmitting(false);
      }
    },
    [username, password, otpCode, router]
  );

  const handleForgotPassword = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setForgotMessage("");
    const identifier = forgotIdentifier.trim();
    if (!identifier) {
      setError("Vui lòng nhập email hoặc username");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.forgotPassword(identifier);
      setForgotMessage(
        res?.message ||
          "Nếu tài khoản tồn tại, email khôi phục mật khẩu đã được gửi."
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể gửi yêu cầu");
    } finally {
      setIsSubmitting(false);
    }
  }, [forgotIdentifier]);

  return (
    <div className="bg-background text-text-main font-display antialiased h-screen w-full overflow-hidden relative selection:bg-primary/30">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-emerald-100/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply"></div>

      <div className="relative flex flex-col h-full w-full max-w-md mx-auto px-6 py-8 safe-area-inset-bottom">
        <div className="flex justify-end pt-4">
          <LanguageSelect variant="light" />
        </div>

        <div className="flex-1 flex flex-col justify-center pb-10">
          <div className="flex flex-col items-center justify-center mb-12">
            <Link href="/register" className="relative group cursor-pointer block">
              <img
                src="/images/14446126.png"
                alt="Shopii Logo"
                className="w-36 h-36 object-contain rounded-2xl transition-transform duration-500 hover:scale-105"
              />
            </Link>
          </div>

          <div className="flex flex-col items-center text-center space-y-4 mb-6">
            <h1 className="text-text-main tracking-tight text-2xl md:text-3xl font-bold leading-[1.15]">
              {t("loginTitle")} <br />
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-teal-600">
                {t("loginSubtitle")}
              </span>
            </h1>
            <p className="text-text-muted text-sm md:text-base font-medium leading-relaxed max-w-[300px] mx-auto">
              {t("loginDescription")}
            </p>
          </div>

          {otpStep === "credentials" && !forgotMode ? (
            <form onSubmit={handleUsernameLogin} className="w-full space-y-4 mb-4">
              <div>
                <label htmlFor="login-username" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("username")}
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("enterUsername") || "Username"}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t("passwordLabel")}
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary-dark hover:to-emerald-700 active:scale-[0.98] text-white h-14 rounded-2xl font-bold text-lg transition-all shadow-glow hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] border border-emerald-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                ) : (
                  t("loginButton")
                )}
              </button>
              <button
                type="button"
                className="w-full py-2 text-sm font-semibold text-primary hover:text-primary-dark"
                onClick={() => {
                  setForgotMode(true);
                  setForgotMessage("");
                  setError("");
                  setForgotIdentifier(username || "");
                }}
              >
                Quên mật khẩu?
              </button>
            </form>
          ) : otpStep === "credentials" && forgotMode ? (
            <form onSubmit={handleForgotPassword} className="w-full space-y-4 mb-4">
              <p className="text-sm text-slate-600">
                Nhập email hoặc username để nhận link đặt lại mật khẩu.
              </p>
              <div>
                <label htmlFor="forgot-identifier" className="block text-sm font-medium text-slate-700 mb-1">
                  Email hoặc username
                </label>
                <input
                  id="forgot-identifier"
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="email@example.com / username"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary-dark hover:to-emerald-700 active:scale-[0.98] text-white h-14 rounded-2xl font-bold text-lg transition-all shadow-glow hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] border border-emerald-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                ) : (
                  "Gửi link đặt lại mật khẩu"
                )}
              </button>
              <button
                type="button"
                className="w-full py-2 text-sm text-slate-600 hover:text-slate-800"
                onClick={() => {
                  setForgotMode(false);
                  setForgotMessage("");
                  setError("");
                }}
              >
                ← Quay lại đăng nhập
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="w-full space-y-4 mb-4">
              <p className="text-sm text-slate-600 text-center">
                Đã gửi mã 6 chữ số tới email{" "}
                {maskedEmail ? <span className="font-semibold text-slate-800">{maskedEmail}</span> : ""}.
              </p>
              {otpInfo ? (
                <p className="text-xs text-slate-500 text-center">{otpInfo}</p>
              ) : null}
              <div>
                <label htmlFor="login-otp" className="block text-sm font-medium text-slate-700 mb-1">
                  Mã xác thực email
                </label>
                <input
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 text-center text-2xl tracking-[0.4em] font-mono placeholder:text-slate-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary-dark hover:to-emerald-700 active:scale-[0.98] text-white h-14 rounded-2xl font-bold text-lg transition-all shadow-glow hover:shadow-[0_0_24px_rgba(16,185,129,0.4)] border border-emerald-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                ) : (
                  "Xác nhận và đăng nhập"
                )}
              </button>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void sendLoginOtp()}
                  className="w-full py-2 text-sm font-semibold text-primary hover:text-primary-dark"
                >
                  Gửi lại mã
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => {
                    setOtpStep("credentials");
                    setOtpCode("");
                    setError("");
                    setOtpInfo("");
                  }}
                  className="w-full py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  ← Quay lại
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="mb-4 w-full rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {forgotMessage && (
            <div className="mb-4 w-full rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {forgotMessage}
            </div>
          )}

          <p className="text-center text-sm text-slate-600">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-semibold text-primary hover:text-primary-dark underline underline-offset-2">
              Đăng ký
            </Link>
          </p>
        </div>

        <div className="w-full pb-6" />
      </div>
    </div>
  );
}
