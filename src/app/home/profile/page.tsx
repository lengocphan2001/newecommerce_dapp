"use client";

import React, { useEffect, useState } from "react";
import { Contract, JsonRpcProvider, formatUnits, getAddress } from "ethers";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/app/i18n/I18nProvider";

const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org/";
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"] as const;

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [usdtBalance, setUsdtBalance] = useState<string>("");
  const [isLoadingUSDT, setIsLoadingUSDT] = useState<boolean>(false);
  const { t } = useI18n();

  useEffect(() => {
    // Get wallet address and chainId from localStorage or window.ethereum
    if (typeof window !== "undefined") {
      const getWalletInfo = async () => {
        // Fast path: show cached BEP-20 USDT from /safepal (if any)
        try {
          const cached = localStorage.getItem("usdtBep20Balance");
          if (cached) setUsdtBalance(cached);
        } catch {
          // ignore
        }

        // Prefer stored wallet address (from /safepal), fallback to injected provider
        try {
          const storedAddr = localStorage.getItem("walletAddress") || "";
          if (storedAddr) setWalletAddress(storedAddr);
        } catch {
          // ignore
        }

        const eth = (window as any).ethereum;
        if (eth) {
          try {
            const accounts = (await eth.request({
              method: "eth_accounts",
            })) as string[];
            if (accounts && accounts.length > 0) {
              const address = accounts[0];
              setWalletAddress(address);
              
              // Get chain ID
              const chainIdHex = (await eth.request({
                method: "eth_chainId",
              })) as string;
              setChainId(chainIdHex);
              
              // Load BEP-20 USDT balance (BSC) regardless of wallet network
              if (address) {
                loadUsdtBep20Balance(address);
              }
            }
          } catch (error) {
            console.error("Error getting wallet info:", error);
          }
        } else {
          // If no injected provider, but we have walletAddress from storage, still try BEP-20 balance
          try {
            const storedAddr = localStorage.getItem("walletAddress") || "";
            if (storedAddr) {
              loadUsdtBep20Balance(storedAddr);
            }
          } catch {
            // ignore
          }
        }
      };
      getWalletInfo();
    }
  }, []);

  const shortAddress = (addr: string) => {
    if (!addr) return "-";
    if (addr.length < 10) return addr;
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  const loadUsdtBep20Balance = async (address: string) => {
    setIsLoadingUSDT(true);
    try {
      const provider = new JsonRpcProvider(BSC_RPC);
      const contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
      const [decimals, balance] = await Promise.all([
        contract.decimals(),
        contract.balanceOf(getAddress(address)),
      ]);
      const formatted = formatUnits(balance as bigint, Number(decimals));
      setUsdtBalance(formatted);
      try {
        localStorage.setItem("usdtBep20Contract", USDT_BSC);
        localStorage.setItem("usdtBep20Decimals", String(Number(decimals)));
        localStorage.setItem("usdtBep20Balance", formatted);
        localStorage.setItem("usdtBep20UpdatedAt", String(Date.now()));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Error loading USDT balance:", error);
      setUsdtBalance("Error");
    } finally {
      setIsLoadingUSDT(false);
    }
  };

  const menuItems = [
    {
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Địa chỉ giao hàng",
      subtitle: "Quản lý địa chỉ nhận hàng",
      action: ">",
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v4a3 3 0 003 3zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "Phương thức thanh toán",
      subtitle: "Thẻ, ví điện tử",
      action: ">",
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
      title: "Mã giảm giá",
      subtitle: "3 mã có sẵn",
      action: ">",
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      title: "Đánh giá của tôi",
      subtitle: "Xem đánh giá đã viết",
      action: ">",
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
      title: "Thông báo",
      subtitle: "Cài đặt thông báo",
      action: ">",
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: "Cài đặt",
      subtitle: "Cài đặt ứng dụng",
      action: ">",
    },
  ];

  return (
    <div className="flex flex-col bg-zinc-50">
      {/* Header */}
      <AppHeader titleKey="profileTitle" />

      <main className="flex-1 pb-28">
        {/* Profile Card */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold">Người dùng</h2>
                <p className="mt-1 text-sm opacity-90">
                  {walletAddress ? shortAddress(walletAddress) : "Chưa kết nối ví"}
                </p>
              </div>
            </div>
            {walletAddress && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span className="text-xs font-medium">Ví đã kết nối</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-xs font-medium">Số dư USDT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">
                      {isLoadingUSDT ? (
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
                      ) : (
                        `${usdtBalance || "0"} USDT`
                      )}
                    </span>
                    {walletAddress && chainId && !isLoadingUSDT && (
                      <button
                        onClick={() => {
                          loadUsdtBep20Balance(walletAddress);
                        }}
                        className="rounded p-1 hover:bg-white/30"
                        title="Làm mới số dư"
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-zinc-900">12</p>
              <p className="mt-1 text-xs text-zinc-500">Đơn hàng</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-zinc-900">8</p>
              <p className="mt-1 text-xs text-zinc-500">Đánh giá</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-zinc-900">3</p>
              <p className="mt-1 text-xs text-zinc-500">Mã giảm giá</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="space-y-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className="flex w-full items-center gap-4 rounded-xl bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
              >
                <div className="text-zinc-600">{item.icon}</div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-zinc-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {item.subtitle}
                  </p>
                </div>
                <div className="text-zinc-400">{item.action}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Logout Button */}
        <div className="mx-auto max-w-2xl px-4 py-4">
          <button className="w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50">
            Đăng xuất
          </button>
        </div>
      </main>

    </div>
  );
}
