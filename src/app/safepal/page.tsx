"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [lastError, setLastError] = useState<string>("");

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
          if (!silent) setStatus("Đã kết nối");
        } else {
          setBalanceWei(BigInt(0));
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
      setStatus("Đang yêu cầu kết nối...");
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      await refresh();
      // Chuyển đến màn hình chính sau khi kết nối thành công
      if (accounts && accounts.length > 0) {
        router.push("/home");
      }
    } catch (e: any) {
      setStatus("Người dùng từ chối hoặc lỗi kết nối");
      setLastError(e?.message ?? String(e));
    }
  }, [refresh, router]);

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
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 active:bg-zinc-950"
            >
              Kết nối ví (eth_requestAccounts)
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


