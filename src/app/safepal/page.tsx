"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../services/api";
import { getUSDTBalance, formatUSDT } from "../utils/wallet";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  // wallet-specific flags (best-effort)
  isSafePal?: boolean;
  isMetaMask?: boolean;
};

function getEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const anyWindow = window as any;
  return anyWindow.ethereum as Eip1193Provider | undefined;
}

function hexToBigInt(hex: string): bigint {
  if (!hex) return BigInt(0);
  return BigInt(hex);
}

function formatEther(wei: bigint, decimals = 18): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = wei / base;
  const fraction = wei % base;
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString();
}

function shortAddress(addr?: string) {
  if (!addr) return "-";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function SafePalConnectPage() {
  const router = useRouter();
  const ethereum = useMemo(() => getEthereum(), []);

  const [status, setStatus] = useState<string>("Chưa kết nối");
  const [address, setAddress] = useState<string>("");
  const [chainIdHex, setChainIdHex] = useState<string>("");
  const [balanceWei, setBalanceWei] = useState<bigint>(BigInt(0));
  const [usdtBalance, setUsdtBalance] = useState<string>("");
  const [isLoadingUSDT, setIsLoadingUSDT] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  const isSafePal = !!ethereum?.isSafePal;

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent;
      setLastError("");

      const eth = getEthereum();
      if (!eth) {
        if (!silent) setStatus("Không tìm thấy provider (window.ethereum)");
        setAddress("");
        setChainIdHex("");
        setBalanceWei(BigInt(0));
        return;
      }

      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        const addr = accounts?.[0] ?? "";
        setAddress(addr);

        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        setChainIdHex(cid ?? "");

        if (addr) {
          const balHex = (await eth.request({
            method: "eth_getBalance",
            params: [addr, "latest"],
          })) as string;
          setBalanceWei(hexToBigInt(balHex));
          
          // Load USDT balance if chainId is available
          if (cid) {
            loadUSDTBalance(eth, addr, cid);
          }
          
          if (!silent) setStatus("Đã kết nối");
        } else {
          setBalanceWei(BigInt(0));
          setUsdtBalance("");
          if (!silent) setStatus("Chưa cấp quyền ví (chưa có account)");
        }
      } catch (e: any) {
        if (!silent) setStatus("Lỗi khi đọc thông tin ví");
        setLastError(e?.message ?? String(e));
      }
    },
    []
  );

  const connect = useCallback(async () => {
    setLastError("");
    const eth = getEthereum();
    if (!eth) {
      setStatus("Không tìm thấy provider (window.ethereum)");
      return;
    }

    try {
      setIsConnecting(true);
      setStatus("Đang yêu cầu kết nối...");
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      await refresh();
      
      // Check if user exists after connecting wallet
      // Temporarily disabled - backend not deployed yet
      if (accounts && accounts.length > 0) {
        const walletAddress = accounts[0];
        // Get chainId if not already available
        let currentChainId = chainIdHex;
        if (!currentChainId) {
          currentChainId = (await eth.request({ method: "eth_chainId" })) as string;
        }
        
        // Store wallet info
        localStorage.setItem('walletAddress', walletAddress);
        if (currentChainId) {
          localStorage.setItem('chainId', currentChainId);
        }
        
        // Directly go to home (skip user check for now)
        setIsNavigating(true);
        setStatus("Đang chuyển đến trang chính...");
        router.push("/home");
        
        /* User check disabled - uncomment when backend is deployed
        try {
          setStatus("Đang kiểm tra tài khoản...");
          const checkResult = await api.checkWallet(walletAddress);
          
          if (checkResult.exists) {
            // User exists, go to home
            setIsNavigating(true);
            setStatus("Đang chuyển đến trang chính...");
            router.push("/home");
          } else {
            // User doesn't exist, redirect to registration
            setIsNavigating(true);
            setStatus("Đang chuyển đến trang đăng ký...");
            router.push(`/register?address=${encodeURIComponent(walletAddress)}&chainId=${encodeURIComponent(currentChainId)}`);
          }
        } catch (error: any) {
          // If API fails, still allow navigation but show error
          console.error("Error checking wallet:", error);
          setLastError("Không thể kiểm tra tài khoản. Vui lòng thử lại.");
          setIsConnecting(false);
        }
        */
      }
    } catch (e: any) {
      setStatus("Người dùng từ chối hoặc lỗi kết nối");
      setLastError(e?.message ?? String(e));
      setIsConnecting(false);
    }
  }, [refresh, router, chainIdHex]);

  useEffect(() => {
    // initial best-effort refresh
    refresh({ silent: true });
  }, [refresh]);

  useEffect(() => {
    const eth = getEthereum();
    if (!eth?.on || !eth?.removeListener) return;

    const onAccountsChanged = (accounts: string[]) => {
      setAddress(accounts?.[0] ?? "");
      // re-pull balance
      refresh({ silent: true });
    };
    const onChainChanged = (cid: string) => {
      setChainIdHex(cid ?? "");
      refresh({ silent: true });
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [refresh]);

  const chainIdDec = useMemo(() => {
    if (!chainIdHex) return "";
    try {
      return String(Number(BigInt(chainIdHex)));
    } catch {
      return "";
    }
  }, [chainIdHex]);

  const loadUSDTBalance = useCallback(async (eth: Eip1193Provider, addr: string, chainId: string) => {
    setIsLoadingUSDT(true);
    try {
      const result = await getUSDTBalance(eth, addr, chainId);
      if (result) {
        const formatted = formatUSDT(result.balance, result.decimals);
        setUsdtBalance(formatted);
      } else {
        setUsdtBalance("N/A");
      }
    } catch (error) {
      console.error("Error loading USDT balance:", error);
      setUsdtBalance("Error");
    } finally {
      setIsLoadingUSDT(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Loading Overlay */}
      {(isConnecting || isNavigating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white border-t-zinc-900"></div>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">SafePal dApp Connector</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Mở trang này trong trình duyệt DApp của SafePal để lấy thông tin ví.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              {ethereum ? "provider: OK" : "provider: none"}
            </span>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">Trạng thái</div>
              <div className="font-medium">{status}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">SafePal detect</div>
              <div className="font-medium">{isSafePal ? "true" : "unknown/false"}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">Địa chỉ</div>
              <div className="font-mono text-xs">{address || "-"}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">Địa chỉ (ngắn)</div>
              <div className="font-mono text-xs">{shortAddress(address)}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">ChainId</div>
              <div className="font-mono text-xs">
                {chainIdHex ? `${chainIdHex}${chainIdDec ? ` (${chainIdDec})` : ""}` : "-"}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">Balance (native)</div>
              <div className="font-mono text-xs">{address ? `${formatEther(balanceWei)} ETH` : "-"}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">Balance (USDT)</div>
              <div className="font-mono text-xs">
                {isLoadingUSDT ? (
                  <span className="inline-flex items-center gap-1">
                    <svg
                      className="h-3 w-3 animate-spin"
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
                    Loading...
                  </span>
                ) : (
                  address ? `${usdtBalance || "0"} USDT` : "-"
                )}
              </div>
            </div>
          </div>

          {lastError ? (
            <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
              <div className="font-semibold">Error</div>
              <div className="mt-1 break-words">{lastError}</div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={connect}
              disabled={isConnecting || isNavigating}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting || isNavigating ? (
                <svg
                  className="h-5 w-5 animate-spin"
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
                "Kết nối ví (eth_requestAccounts)"
              )}
            </button>
            <button
              onClick={() => refresh()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 text-xs text-zinc-500">
            Gợi ý: nếu bạn mở bằng browser thường mà không có ví, trang sẽ báo <span className="font-mono">provider: none</span>.
          </div>
        </div>
      </div>
    </div>
  );
}


