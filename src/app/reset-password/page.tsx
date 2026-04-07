"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/services/api";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validatePassword = (value: string) => {
    const hasMinLen = value.length >= 12;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecial = /[^A-Za-z0-9]/.test(value);
    return hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Link không hợp lệ hoặc đã hết hạn.");
      return;
    }
    if (!validatePassword(newPassword)) {
      setError(
        "Mật khẩu cần tối thiểu 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.resetPassword(token, newPassword);
      setSuccess(res?.message || "Đặt lại mật khẩu thành công.");
      setTimeout(() => router.push("/"), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể đặt lại mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Đặt lại mật khẩu</h1>
        <p className="text-sm text-slate-600 mb-6">
          Nhập mật khẩu mới để hoàn tất khôi phục tài khoản.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              placeholder="••••••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Xác nhận mật khẩu
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
              placeholder="••••••••••••"
            />
          </div>

          {error ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-purple-950 font-bold disabled:opacity-60"
          >
            {submitting ? "Đang xử lý..." : "Cập nhật mật khẩu"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600 text-center">
          <Link href="/" className="text-primary font-semibold hover:text-primary-dark">
            Quay lại đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
