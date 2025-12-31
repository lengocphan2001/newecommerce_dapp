"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, getAddress } from "ethers";
import { useI18n } from "@/app/i18n/I18nProvider";
import LanguageSelect from "@/app/components/LanguageSelect";

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

export default function SafePalPage() {
  const router = useRouter();
  const { t } = useI18n();

  const ethereum = useMemo(() => getEthereum(), []);
  const bscProvider = useMemo(() => new JsonRpcProvider(BSC_RPC), []);

  const [address, setAddress] = useState<string>("");
  const [isBusy, setIsBusy] = useState<boolean>(false);
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
    setIsBusy(true);
    try {
      const eth = getEthereum();
      const injectedProvider = eth ? new BrowserProvider(eth as any) : null;

      const addr = address || (await connectWallet());
      if (!addr) return;

      // Store current chainId (for register flow), but still fetch USDT on BSC by default.
      try {
        if (eth) {
          const chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
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

      await fetchUsdtBep20AndStore(addr);
      router.push("/home");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsBusy(false);
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
    <div className="min-h-screen bg-[#0f7c66] text-white">
      <div className="mx-auto max-w-md px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="text-xs opacity-80">{ethereum ? "provider: OK" : "provider: none"}</div>
          <LanguageSelect variant="dark" />
        </div>

        <div className="mt-10 flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0a5b4c]">
            <div className="h-14 w-14 rounded-2xl border-4 border-white/80" />
          </div>

          <div className="mt-6 text-4xl font-bold tracking-tight">{t("appName")}</div>
          <div className="mt-10 text-3xl font-semibold">{t("login")}</div>

          <div className="mt-6 w-full rounded-2xl bg-[#0c6a58] px-6 py-4 text-center text-xl font-semibold">
            {address ? shortAddress(address) : "0x----‑----‑----"}
          </div>

          <div className="mt-5 w-full space-y-4">
            <button
              onClick={async () => {
                setIsBusy(true);
                try {
                  await refreshAddress();
                } finally {
                  setIsBusy(false);
                }
              }}
              disabled={isBusy}
              className="w-full rounded-2xl bg-[#2f9e8f] py-4 text-lg font-bold text-yellow-200 transition-colors hover:bg-[#2aa193] disabled:opacity-60"
            >
              {t("reload")}
            </button>

            <button
              onClick={nextToHome}
              disabled={isBusy}
              className="w-full rounded-2xl bg-[#f6a500] py-4 text-lg font-bold text-yellow-200 transition-colors hover:bg-[#ffb11a] disabled:opacity-60"
            >
              {t("nextToLogin")}
            </button>
          </div>

          {error ? <div className="mt-6 w-full text-sm text-white/90">{error}</div> : null}

          <div className="mt-6 text-xs text-white/70">SafePal: {isSafePal ? "true" : "unknown/false"}</div>
        </div>
      </div>
    </div>
  );
}


