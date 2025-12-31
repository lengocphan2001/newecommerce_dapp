"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatEther, formatUnits, getAddress } from "ethers";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  // wallet-specific flags (best-effort)
  isSafePal?: boolean;
  isMetaMask?: boolean;
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

// Common USDT addresses (EVM) by chainId (hex string)
const USDT_BY_CHAIN: Record<string, string> = {
  "0x1": "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum
  "0x38": "0x55d398326f99059fF775485246999027B3197955", // BSC
  "0x89": "0xc2132D05D31c914a87C6611C10748AaCBdA1D28", // Polygon
  "0xa": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism
  "0xa4b1": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum One
  "0xa86a": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // Avalanche C-Chain (USDT.e)
};

function getEthereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  const anyWindow = window as any;
  return anyWindow.ethereum as Eip1193Provider | undefined;
}

function isAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function shortAddress(addr?: string) {
  if (!addr) return "-";
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function getTokenOverrideFromUrl(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("usdt") || params.get("token") || "").trim();
}

export default function SafePalConnectPage() {
  const ethereum = useMemo(() => getEthereum(), []);

  const [status, setStatus] = useState<string>("Chưa kết nối");
  const [address, setAddress] = useState<string>("");
  const [chainIdHex, setChainIdHex] = useState<string>("");
  const [nativeBalance, setNativeBalance] = useState<string>("");
  const [usdtBalance, setUsdtBalance] = useState<string>("");
  const [usdtAddress, setUsdtAddress] = useState<string>("");
  const [usdtDecimals, setUsdtDecimals] = useState<number>(0);
  const [usdtSymbol, setUsdtSymbol] = useState<string>("USDT");
  const [isLoadingUSDT, setIsLoadingUSDT] = useState<boolean>(false);
  const [lastError, setLastError] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

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
        setNativeBalance("");
        setUsdtBalance("");
        setUsdtAddress("");
        setUsdtDecimals(0);
        setUsdtSymbol("USDT");
        return;
      }

      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        const addr = accounts?.[0] ?? "";
        setAddress(addr);

        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        setChainIdHex(cid ?? "");

        if (addr) {
          const provider = new BrowserProvider(eth as any);

          // Native balance
          const native = await provider.getBalance(addr);
          setNativeBalance(formatEther(native));
          
          // USDT via direct contract call (ethers)
          const override = getTokenOverrideFromUrl();
          const token = override && isAddress(override) ? override : USDT_BY_CHAIN[(cid ?? "").toLowerCase()] ?? "";
          setUsdtAddress(token);

          if (token) {
            setIsLoadingUSDT(true);
            try {
              const contract = new Contract(getAddress(token), ERC20_ABI, provider);
              const [decRaw, balRaw] = await Promise.all([
                contract.decimals(),
                contract.balanceOf(getAddress(addr)),
              ]);
              // symbol() sometimes fails on some tokens; best-effort
              try {
                const sym = await contract.symbol();
                if (typeof sym === "string" && sym) setUsdtSymbol(sym);
              } catch {
                setUsdtSymbol("USDT");
              }

              const decimals = Number(decRaw);
              setUsdtDecimals(Number.isFinite(decimals) ? decimals : 0);
              setUsdtBalance(formatUnits(balRaw as bigint, Number.isFinite(decimals) ? decimals : 0));
            } catch (e: any) {
              setUsdtBalance("Error");
              setLastError(e?.message ?? String(e));
            } finally {
              setIsLoadingUSDT(false);
            }
          } else {
            setUsdtBalance("N/A");
          }
          
          if (!silent) setStatus("Đã kết nối");
        } else {
          setNativeBalance("");
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

  const switchToBsc = useCallback(async () => {
    setLastError("");
    const eth = getEthereum();
    if (!eth) {
      setLastError("Không tìm thấy provider (window.ethereum)");
      return;
    }

    try {
      // Try switch to BSC Mainnet (chainId 56 => 0x38)
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x38" }],
      });
    } catch (e: any) {
      // 4902: unknown chain -> add it
      const code = e?.code;
      if (code === 4902 || `${code}` === "4902") {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x38",
              chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-dataseed.binance.org/"],
              blockExplorerUrls: ["https://bscscan.com"],
            },
          ],
        });
      } else {
        setLastError(e?.message ?? String(e));
        return;
      }
    }

    // Refresh after switching chain
    await refresh({ silent: true });
  }, [refresh]);

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
      await eth.request({ method: "eth_requestAccounts" });
      await refresh();
    } catch (e: any) {
      setStatus("Người dùng từ chối hoặc lỗi kết nối");
      setLastError(e?.message ?? String(e));
    } finally {
      setIsConnecting(false);
    }
  }, [refresh]);

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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Loading Overlay */}
      {isConnecting && (
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
              <div className="font-mono text-xs">{address ? `${nativeBalance || "0"} (native)` : "-"}</div>
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
                  address ? `${usdtBalance || "0"} ${usdtSymbol || "USDT"}` : "-"
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">USDT contract</div>
              <div className="font-mono text-xs">{usdtAddress || "N/A"}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="text-zinc-600">USDT decimals</div>
              <div className="font-mono text-xs">{usdtDecimals ? String(usdtDecimals) : "-"}</div>
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
              disabled={isConnecting}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnecting ? (
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
              onClick={switchToBsc}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-solid border-black/[.08] bg-white px-4 text-sm font-semibold text-zinc-900 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              title="Chuyển sang BSC để đọc USDT BEP-20 (0x55d398...)"
            >
              Switch to BSC (BEP20)
            </button>
            <button
              onClick={() => refresh()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300"
            >
              Refresh
            </button>
          </div>

          <div className="mt-6 text-xs text-zinc-500">
            Gợi ý: USDT là ERC-20 nên phải gọi contract <span className="font-mono">balanceOf(address)</span>.
            Bạn có thể override token: <span className="font-mono">/safepal?usdt=0x...</span>
          </div>
        </div>
      </div>
    </div>
  );
}


