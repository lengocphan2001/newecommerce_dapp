"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org/";

function getEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum as Eip1193Provider | undefined;
}

/** Lazy-load ethers only when connecting/fetching balance — giảm bundle initial cho trình duyệt ví (SafePal, Binance). */
async function fetchUsdtBep20AndStore(walletAddress: string): Promise<string> {
  const { Contract, JsonRpcProvider, formatUnits, getAddress } = await import("ethers");
  const bscProvider = new JsonRpcProvider(BSC_RPC);
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
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();

  const [address, setAddress] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

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
    setIsConnecting(true);
    const eth = getEthereum();
    if (!eth) {
      setError(t("walletNotFound"));
      setIsConnecting(false);
      return "";
    }
    try {
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
    } catch (e: any) {
      setError((e?.message ?? String(e)) || t("cannotConnectWallet"));
      return "";
    } finally {
      setIsConnecting(false);
    }
  }, [t]);

  const handleConnectAndLogin = useCallback(async () => {
    setError("");
    setIsConnecting(true);
    try {
      const eth = getEthereum();
      // Lazy-load ethers only when user clicks Connect (giảm thời gian load trang đầu trên ví)
      const ethers = await import("ethers");
      const injectedProvider = eth ? new ethers.BrowserProvider(eth as any) : null;

      const addr = address || (await connectWallet());
      if (!addr) {
        setIsConnecting(false);
        return;
      }

      try {
        localStorage.setItem("walletAddress", addr);
      } catch {
        // ignore
      }

      let chainIdHex = "";
      try {
        if (eth) {
          chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
          if (chainIdHex) localStorage.setItem("chainId", chainIdHex);
        }
      } catch {
        // ignore
      }

      try {
        await injectedProvider?.getNetwork();
      } catch {
        // ignore
      }

      try {
        const checkResult = await api.checkWallet(addr);
        if (!checkResult.exists) {
          router.push("/register");
          return;
        }

        try {
          const loginResult = await api.walletLogin(addr);
          if (loginResult.token) {
            localStorage.setItem("token", loginResult.token);
          }
        } catch (loginError: any) {
          const existingToken = localStorage.getItem("token");
          if (!existingToken) {
            router.push("/register");
            return;
          }
        }
      } catch (e: any) {
        const existingToken = localStorage.getItem("token");
        if (!existingToken) {
          router.push("/register");
          return;
        }
      }

      // Chuyển vào /home ngay, fetch USDT nền sau (trải nghiệm nhanh hơn trên ví)
      router.push("/home");
      fetchUsdtBep20AndStore(addr).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsConnecting(false);
    }
  }, [address, connectWallet, router]);

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
    <div className="bg-background text-text-main font-display antialiased h-screen w-full overflow-hidden relative selection:bg-primary/30">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-primary/10 rounded-full blur-[80px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-5%] right-[-5%] w-[60%] h-[40%] bg-blue-100/40 rounded-full blur-[80px] pointer-events-none mix-blend-multiply"></div>

      <div className="relative flex flex-col h-full w-full max-w-md mx-auto px-6 py-8 safe-area-inset-bottom">
        {/* Language selector */}
        <div className="flex justify-end pt-4">
          <LanguageSelect variant="light" />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col justify-center pb-10">
          {/* Logo section */}
          <div className="flex flex-col items-center justify-center mb-12">
            <Link href="/register" className="relative group cursor-pointer block">
              <img
                src="/images/14446126.png"
                alt="Shopii Logo"
                className="w-36 h-36 object-contain rounded-2xl transition-transform duration-500 hover:scale-105"
              />
            </Link>
          </div>

          {/* Title and description */}
          <div className="flex flex-col items-center text-center space-y-6">
            <h1 className="text-text-main tracking-tight text-3xl md:text-4xl font-bold leading-[1.15]">
              {t("loginTitle")} <br />
              <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                {t("loginSubtitle")}
              </span>
            </h1>
            <p className="text-text-muted text-base md:text-lg font-medium leading-relaxed max-w-[300px] mx-auto">
              {t("loginDescription")}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="w-full space-y-6 pb-6">
          <button
            onClick={handleConnectAndLogin}
            disabled={isConnecting}
            className="w-full group relative flex items-center justify-center gap-3 bg-gradient-to-r from-primary to-purple-500 hover:from-primary-dark hover:to-purple-600 active:scale-[0.98] text-purple-950 h-16 rounded-2xl font-bold text-lg transition-all duration-300 shadow-glow hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] border border-purple-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-purple-950/60 border-t-purple-950"></span>
            ) : (
              <>
                <div className="bg-white/20 p-2 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <span className="material-symbols-outlined !text-[22px] text-purple-950">
                    account_balance_wallet
                  </span>
                </div>
                <span>{t("connectSafePalWallet")}</span>
                <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>
                </div>
              </>
            )}
          </button>

          <div className="flex flex-col items-center gap-5">
            <button className="group flex items-center gap-2 text-text-muted text-sm font-semibold hover:text-primary transition-colors py-2 px-4 rounded-full hover:bg-slate-50">
              <span>{t("whatIsSafePal")}</span>
              <span className="material-symbols-outlined !text-[18px] group-hover:rotate-12 transition-transform">help</span>
            </button>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium tracking-wide uppercase">
              <span className="material-symbols-outlined !text-[14px]">verified_user</span>
              <span>{t("securedByWeb3")}</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 w-full rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
