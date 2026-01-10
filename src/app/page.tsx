"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, getAddress } from "ethers";
import { useI18n } from "@/app/i18n/I18nProvider";
import LanguageSelect from "@/app/components/LanguageSelect";
import { api } from "@/app/services/api";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  isSafePal?: boolean;
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

// Default: always read USDT BEP-20 on BSC (no wallet network switch needed)
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org/";

function getEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum as Eip1193Provider | undefined;
}

function shortAddress(addr?: string) {
  if (!addr) return "-";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  const ethereum = useMemo(() => getEthereum(), []);
  const bscProvider = useMemo(() => new JsonRpcProvider(BSC_RPC), []);

  const [address, setAddress] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [isNextLoading, setIsNextLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const isSafePal =
    typeof window !== "undefined" &&
    (!!(window as any).ethereum?.isSafePal || navigator.userAgent.toLowerCase().includes("safepal"));

  const refreshAddress = useCallback(async () => {
    setError("");
    const eth = getEthereum();
    if (!eth) {
      setAddress("");
      return;
    }
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      setAddress(accounts?.[0] ?? "");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setError("");
    const eth = getEthereum();
    if (!eth) {
      setError("No injected provider (window.ethereum)");
      return "";
    }
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    const addr = accounts?.[0] ?? "";
    setAddress(addr);
    if (addr) {
      try {
        localStorage.setItem("walletAddress", addr);
      } catch {
        // ignore
      }
    }
    return addr;
  }, []);

  const fetchUsdtBep20AndStore = useCallback(
    async (walletAddress: string) => {
      // Read BEP-20 USDT on BSC via public RPC (no chain switch)
      const contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, bscProvider);
      const [decimals, balance] = await Promise.all([
        contract.decimals(),
        contract.balanceOf(getAddress(walletAddress)),
      ]);
      const formatted = formatUnits(balance as bigint, Number(decimals));

      try {
        localStorage.setItem("usdtBep20Contract", USDT_BSC);
        localStorage.setItem("usdtBep20Decimals", String(Number(decimals)));
        localStorage.setItem("usdtBep20Balance", formatted);
        localStorage.setItem("usdtBep20UpdatedAt", String(Date.now()));
      } catch {
        // ignore
      }
      return formatted;
    },
    [bscProvider]
  );

  const nextToHome = useCallback(async () => {
    setError("");
    setIsNextLoading(true);
    try {
      const eth = getEthereum();
      const injectedProvider = eth ? new BrowserProvider(eth as any) : null;

      const addr = address || (await connectWallet());
      if (!addr) return;

      // Store wallet address in localStorage (for register flow if needed)
      try {
        localStorage.setItem("walletAddress", addr);
      } catch {
        // ignore
      }

      // Store current chainId (for register flow), but still fetch USDT on BSC by default.
      let chainIdHex = "";
      try {
        if (eth) {
          chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
          if (chainIdHex) localStorage.setItem("chainId", chainIdHex);
        }
      } catch {
        // ignore
      }

      // Warm-up: make sure injected provider is alive (helps some in-app browsers)
      try {
        await injectedProvider?.getNetwork();
      } catch {
        // ignore
      }

      // Check if wallet address is already registered
      try {
        const checkResult = await api.checkWallet(addr);
        if (!checkResult.exists) {
          // User not registered, redirect to register page (wallet info already in localStorage)
          router.push("/register");
          return;
        }
        
        // User exists, authenticate them to get a token
        try {
          const loginResult = await api.walletLogin(addr);
          if (loginResult.token) {
            localStorage.setItem("token", loginResult.token);
          }
        } catch (loginError: any) {
          // If login fails, log but continue (user might still have a valid token)
        }
      } catch (e: any) {
        // If check fails, assume user exists and continue (fallback behavior)
      }

      // User exists, continue to home
      await fetchUsdtBep20AndStore(addr);
      router.push("/home");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsNextLoading(false);
    }
  }, [address, connectWallet, fetchUsdtBep20AndStore, router]);

  useEffect(() => {
    refreshAddress();
  }, [refreshAddress]);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth?.on || !eth?.removeListener) return;

    const onAccountsChanged = () => refreshAddress();
    eth.on("accountsChanged", onAccountsChanged);
    return () => eth.removeListener?.("accountsChanged", onAccountsChanged);
  }, [refreshAddress]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f7c66] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="text-xs opacity-80"></div>
          <LanguageSelect variant="dark" />
        </div>

        <div className="mt-10 flex flex-col items-center">
          <div className="flex h-44 w-80 items-center justify-center">
            <img
              src="/images/logo1.png"
              alt="VinMall Logo"
              className="h-full w-full object-contain"
            />
          </div>

          <div className="mt-10 text-3xl font-semibold">{t("login")}</div>

          <div className="mt-6 w-full rounded-2xl bg-white/10 px-6 py-4 text-center text-xl font-semibold ring-1 ring-white/20 backdrop-blur-sm">
            {address ? shortAddress(address) : "0x----‑----‑----"}
          </div>

          <div className="mt-5 w-full space-y-4">
            <button
              onClick={async () => {
                setIsReloading(true);
                try {
                  // If chưa connect thì eth_accounts sẽ rỗng -> gọi connect để user approve
                  if (!address) {
                    await connectWallet();
                  } else {
                    await refreshAddress();
                  }
                } finally {
                  setIsReloading(false);
                }
              }}
              disabled={isReloading || isNextLoading}
              className="group w-full rounded-2xl bg-white/10 py-4 text-lg font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/15 disabled:opacity-60"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isReloading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                ) : (
                  <svg className="h-5 w-5 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                )}
                {t("reload")}
              </span>
            </button>

            <button
              onClick={nextToHome}
              disabled={isReloading || isNextLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#ffb11a] to-[#f6a500] py-4 text-lg font-bold text-white shadow-lg shadow-black/10 transition-all hover:brightness-105 active:brightness-95 disabled:opacity-60"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {isNextLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                ) : null}
                {t("nextToLogin")}
              </span>
            </button>
          </div>

          {error ? (
            <div className="mt-6 w-full rounded-2xl bg-black/10 p-3 text-sm text-white/90 ring-1 ring-white/15">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
