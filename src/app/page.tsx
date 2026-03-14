"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";
import LanguageSelect from "@/app/components/LanguageSelect";
import { api } from "@/app/services/api";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const handleUsernameLogin = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
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
      } catch (err: any) {
        setError(err?.message || "Login failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [username, password, router, t]
  );

  return (
    <div className="bg-background text-text-main font-display antialiased h-screen w-full overflow-hidden relative selection:bg-primary/30">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-blue-100/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply"></div>

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
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                {t("loginSubtitle")}
              </span>
            </h1>
            <p className="text-text-muted text-sm md:text-base font-medium leading-relaxed max-w-[300px] mx-auto">
              {t("loginDescription")}
            </p>
          </div>

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
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary-dark hover:to-purple-600 active:scale-[0.98] text-purple-950 h-14 rounded-2xl font-bold text-lg transition-all shadow-glow hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] border border-purple-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-950/60 border-t-purple-950" />
              ) : (
                t("loginButton")
              )}
            </button>
          </form>

          {error && (
            <div className="mb-4 w-full rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
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
