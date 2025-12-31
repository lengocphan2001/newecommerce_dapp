"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../services/api";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    username: "",
    country: "",
    phoneNumber: "",
    email: "",
    referralUser: "",
  });

  const [walletAddress, setWalletAddress] = useState("");
  const [chainId, setChainId] = useState("");

  useEffect(() => {
    // Get wallet address and chainId from URL params or localStorage
    const address = searchParams.get("address") || localStorage.getItem("walletAddress") || "";
    const chainIdParam = searchParams.get("chainId") || localStorage.getItem("chainId") || "";

    if (!address) {
      router.push("/safepal");
      return;
    }

    setWalletAddress(address);
    setChainId(chainIdParam);
  }, [searchParams, router]);

  const countries = [
    { code: "VN", name: "Việt Nam" },
    { code: "US", name: "United States" },
    { code: "GB", name: "United Kingdom" },
    { code: "JP", name: "Japan" },
    { code: "KR", name: "South Korea" },
    { code: "CN", name: "China" },
    { code: "SG", name: "Singapore" },
    { code: "TH", name: "Thailand" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.username.trim()) {
      setError("Vui lòng nhập tên người dùng");
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

    if (!walletAddress || !chainId) {
      setError("Thông tin ví không hợp lệ");
      return;
    }

    setIsLoading(true);

    try {
      const result = await api.walletRegister({
        walletAddress,
        chainId,
        username: formData.username.trim(),
        country: formData.country,
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        referralUser: formData.referralUser.trim() || undefined,
      });

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

  return (
    <div className="min-h-screen bg-zinc-50 py-8 px-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Đăng ký tài khoản</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Hoàn tất thông tin để tạo tài khoản
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Wallet Info (Read-only) */}
          <div className="rounded-xl bg-blue-50 p-4">
            <div className="mb-2 text-xs font-medium text-blue-900">Thông tin ví (tự động điền)</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Địa chỉ ví:</span>
                <span className="font-mono text-xs text-zinc-900">
                  {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Chain ID:</span>
                <span className="font-mono text-xs text-zinc-900">
                  {chainIdDec || chainId || "-"}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              Thông tin này được lấy từ ví của bạn và không thể thay đổi
            </p>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-zinc-700">
              Tên người dùng <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nhập tên người dùng"
              required
            />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="country" className="mb-1 block text-sm font-medium text-zinc-700">
              Quốc gia <span className="text-red-500">*</span>
            </label>
            <select
              id="country"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              required
            >
              <option value="">Chọn quốc gia</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phoneNumber" className="mb-1 block text-sm font-medium text-zinc-700">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nhập số điện thoại"
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
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nhập email"
              required
            />
          </div>

          {/* Referral User */}
          <div>
            <label htmlFor="referralUser" className="mb-1 block text-sm font-medium text-zinc-700">
              Mã giới thiệu (tùy chọn)
            </label>
            <input
              type="text"
              id="referralUser"
              value={formData.referralUser}
              onChange={(e) => setFormData({ ...formData, referralUser: e.target.value })}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nhập mã giới thiệu"
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
                Đang đăng ký...
              </span>
            ) : (
              "Đăng ký"
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
