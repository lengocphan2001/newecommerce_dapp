"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import TransactionProcessingModal, { ProcessingStep } from "@/app/components/TransactionProcessingModal";
import { api } from "@/app/services/api";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits, getAddress } from "ethers";
import { useI18n } from "@/app/i18n/I18nProvider";

const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org/";
const BSC_CHAIN_ID = "0x38";

function getEthereum() {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum;
}

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

async function pollTransactionReceipt(txHash: string, timeout: number = 120000): Promise<any> {
  const provider = new JsonRpcProvider(BSC_RPC);
  const startTime = Date.now();
  let lastError: any = null;
  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status === 1) return receipt;
        if (receipt.status === 0) throw new Error("Transaction failed on blockchain");
      }
      lastError = null;
    } catch (error: any) {
      if (error.message?.includes("failed")) throw error;
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (lastError) throw new Error(`Transaction polling failed: ${lastError.message}`);
  throw new Error("Transaction confirmation timeout");
}

export default function PackageCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const purchaseId = searchParams.get("purchaseId") || "";
  const amountParam = searchParams.get("amount");
  const packageName = searchParams.get("packageName") || "Package";
  const amount = amountParam ? parseFloat(amountParam) : 0;

  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "banking">("wallet");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>("0");
  const [bankingConfig, setBankingConfig] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    qrImageUrl?: string;
    isEnabled: boolean;
  } | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<"bankName" | "accountNumber" | "accountName" | "content" | null>(null);
  const [usdtToVnd, setUsdtToVnd] = useState<number | null>(null);

  const userWalletAddress = walletAddress || (typeof window !== "undefined" ? localStorage.getItem("walletAddress") : null);

  useEffect(() => {
    if (!purchaseId || !amount || amount <= 0) {
      router.replace("/home/profile");
      return;
    }
  }, [purchaseId, amount, router]);

  useEffect(() => {
    if (paymentMethod === "banking") {
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd")
        .then((res) => res.json())
        .then((data: { tether?: { vnd?: number } }) => {
          const rate = data?.tether?.vnd;
          if (typeof rate === "number" && rate > 0) setUsdtToVnd(rate);
        })
        .catch(() => setUsdtToVnd(null));
    }
  }, [paymentMethod]);

  const loadUsdtBalance = useCallback(async (address: string) => {
    try {
      const provider = new JsonRpcProvider(BSC_RPC);
      const contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
      const [decimals, balance] = await Promise.all([
        contract.decimals(),
        contract.balanceOf(getAddress(address)),
      ]);
      setUsdtBalance(formatUnits(balance as bigint, Number(decimals)));
    } catch {
      setUsdtBalance("0");
    }
  }, []);

  const loadWalletInfo = useCallback(async () => {
    const eth = getEthereum();
    if (!eth) {
      const storedAddr = localStorage.getItem("walletAddress");
      if (storedAddr) {
        setWalletAddress(storedAddr);
        await loadUsdtBalance(storedAddr);
      }
      return;
    }
    try {
      await eth.request({ method: "eth_requestAccounts" });
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      if (accounts?.length > 0) {
        const addr = accounts[0];
        setWalletAddress(addr);
        await loadUsdtBalance(addr);
      } else {
        const storedAddr = localStorage.getItem("walletAddress");
        if (storedAddr) {
          setWalletAddress(storedAddr);
          await loadUsdtBalance(storedAddr);
        }
      }
    } catch {
      const storedAddr = localStorage.getItem("walletAddress");
      if (storedAddr) {
        setWalletAddress(storedAddr);
        await loadUsdtBalance(storedAddr);
      }
    }
  }, [loadUsdtBalance]);

  useEffect(() => {
    loadWalletInfo();
    api.getBankingConfig().then((c) => setBankingConfig(c)).catch(() => setBankingConfig(null));
  }, [loadWalletInfo]);

  const connectWallet = async () => {
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Vui lòng cài đặt ví");
        return;
      }
      await eth.request({ method: "eth_requestAccounts" });
      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] });
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: BSC_CHAIN_ID,
                chainName: "Binance Smart Chain",
                nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                rpcUrls: ["https://bsc-dataseed.binance.org/"],
                blockExplorerUrls: ["https://bscscan.com/"],
              }],
            });
          } else throw switchError;
        }
      }
      await loadWalletInfo();
      setError("");
    } catch (err: any) {
      setError(err.message || "Không thể kết nối ví");
    }
  };

  const copyToClipboard = async (text: string, field: "bankName" | "accountNumber" | "accountName" | "content") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handlePayment = async () => {
    if (paymentMethod === "banking") {
      setProcessingStep("success");
      setError("");
      return;
    }
    if (!walletAddress) {
      setError("Vui lòng kết nối ví");
      return;
    }
    if (parseFloat(usdtBalance || "0") < amount) {
      setError("Số dư USDT không đủ");
      return;
    }

    setProcessingStep("confirming");
    setError("");

    try {
      const eth = getEthereum();
      if (!eth) throw new Error("Ví không khả dụng");

      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_CHAIN_ID }] });
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: BSC_CHAIN_ID,
                chainName: "Binance Smart Chain",
                nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                rpcUrls: ["https://bsc-dataseed.binance.org/"],
                blockExplorerUrls: ["https://bscscan.com/"],
              }],
            });
          } else throw new Error("Vui lòng chuyển sang mạng BSC");
        }
      }

      let decimals = 18;
      try {
        const cached = localStorage.getItem("usdtBep20Decimals");
        if (cached) decimals = parseInt(cached, 10);
        else {
          const readProvider = new JsonRpcProvider(BSC_RPC);
          const readContract = new Contract(getAddress(USDT_BSC), ERC20_ABI, readProvider);
          decimals = Number(await readContract.decimals());
          localStorage.setItem("usdtBep20Decimals", String(decimals));
        }
      } catch {}

      const recipientAddress = process.env.NEXT_PUBLIC_PAYMENT_WALLET;
      if (!recipientAddress || recipientAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Cửa hàng chưa thiết lập ví nhận thanh toán");
      }

      const provider = new BrowserProvider(eth as any);
      const signer = await provider.getSigner();
      const usdtContract = new Contract(USDT_BSC, ERC20_ABI, signer);
      const formattedTotal = parseFloat(amount.toFixed(4)).toString();
      const amountWei = parseUnits(formattedTotal, decimals);

      setProcessingStep("processing");
      await new Promise((r) => setTimeout(r, 500));

      const transferTx = await usdtContract.transfer(recipientAddress, amountWei, { gasLimit: 150000 });
      const transactionHash = transferTx.hash;

      let receipt;
      try {
        receipt = await Promise.race([
          transferTx.wait(1),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Wait timeout")), 30000)),
        ]) as any;
      } catch {
        receipt = await pollTransactionReceipt(transactionHash, 60000);
      }
      if (!receipt?.hash) throw new Error("Không thể xác nhận giao dịch");
      const isSuccess = receipt.status === 1 || receipt.status === "0x1" || receipt.status === true;
      if (!isSuccess) throw new Error("Giao dịch thất bại trên blockchain");

      setProcessingStep("creating_order");
      await api.confirmPackagePayment(purchaseId, transactionHash);

      setProcessingStep("success");
      setTimeout(() => router.push("/home/profile"), 2000);
    } catch (err: any) {
      if (err.code === "ACTION_REJECTED" || err.code === 4001 || err?.message?.includes("rejected")) {
        setError("Bạn đã hủy giao dịch");
      } else {
        setError(err.message || "Thanh toán thất bại");
      }
      setProcessingStep("error");
    }
  };

  const formatPrice = (p: number) =>
    Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(p);
  const formatVnd = (v: number) =>
    Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
  const formatBalance = (b: string) =>
    Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(parseFloat(b || "0"));
  const shortAddress = (addr?: string | null) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—");

  if (!purchaseId || !amount || amount <= 0) {
    return null;
  }

  return (
    <div className="bg-background-light font-display text-text-main antialiased flex flex-col min-h-screen">
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-purple-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => router.back()} className="size-10 flex items-center justify-center rounded-full bg-purple-50 hover:bg-purple-100 text-slate-600">
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-text-main tracking-tight">Thanh toán gói</h1>
        <div className="size-10" />
      </div>

      <div className="flex-1 px-4 py-6 space-y-6 max-w-lg mx-auto w-full">
        <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100">
          <p className="text-sm text-slate-500">Gói</p>
          <p className="font-bold text-slate-900 text-lg">{decodeURIComponent(packageName)}</p>
          <p className="text-2xl font-bold text-primary mt-2">{formatPrice(amount)} USDT</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-700">Phương thức thanh toán</h2>
          <div className="flex rounded-xl border-2 border-purple-100 bg-white p-1">
            <button
              type="button"
              onClick={() => setPaymentMethod("wallet")}
              className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-lg transition ${paymentMethod === "wallet" ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-purple-50"}`}
            >
              Ví (USDT)
            </button>
            <button
              type="button"
              onClick={() => bankingConfig?.isEnabled && setPaymentMethod("banking")}
              className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-lg transition ${paymentMethod === "banking" ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-purple-50"} ${!bankingConfig?.isEnabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Chuyển khoản
            </button>
          </div>

          {paymentMethod === "wallet" && (
            <>
              <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Ví BEP20</p>
                  <p className="text-xs font-mono text-slate-500">{shortAddress(walletAddress)}</p>
                </div>
                {walletAddress ? (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Đã kết nối</span>
                ) : (
                  <button onClick={connectWallet} className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-md">
                    Kết nối
                  </button>
                )}
              </div>
              <div className="p-3.5 rounded-xl border-2 border-primary bg-purple-50">
                <p className="text-xs text-slate-500">USDT (BEP20)</p>
                <p className="font-bold text-slate-900">Số dư: {formatBalance(usdtBalance)}</p>
              </div>
            </>
          )}

          {paymentMethod === "banking" && bankingConfig?.isEnabled && bankingConfig && (
            <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100 space-y-4">
              <p className="text-sm text-slate-600">Chuyển khoản theo thông tin sau. Ghi nội dung chuyển khoản để admin xác nhận.</p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-0.5">Số tiền</p>
                <p className="font-bold text-slate-900 text-lg">{formatPrice(amount)} USDT</p>
                {usdtToVnd != null && <p className="text-sm text-slate-600 mt-0.5">≈ {formatVnd(amount * usdtToVnd)}</p>}
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Ngân hàng</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{bankingConfig.bankName || "—"}</span>
                    {bankingConfig.bankName && (
                      <button type="button" onClick={() => copyToClipboard(bankingConfig.bankName!, "bankName")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {copiedField === "bankName" ? "Đã copy" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Số TK</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold font-mono text-slate-900 truncate">{bankingConfig.accountNumber || "—"}</span>
                    {bankingConfig.accountNumber && (
                      <button type="button" onClick={() => copyToClipboard(bankingConfig.accountNumber!, "accountNumber")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {copiedField === "accountNumber" ? "Đã copy" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">Chủ TK</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{bankingConfig.accountName || "—"}</span>
                    {bankingConfig.accountName && (
                      <button type="button" onClick={() => copyToClipboard(bankingConfig.accountName!, "accountName")} className="shrink-0 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {copiedField === "accountName" ? "Đã copy" : "Copy"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Nội dung chuyển khoản (bắt buộc):</strong>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <code className="flex-1 min-w-0 break-all font-mono bg-amber-100/80 px-2 py-1.5 rounded">{purchaseId}</code>
                  <button type="button" onClick={() => copyToClipboard(purchaseId, "content")} className="shrink-0 px-2 py-1.5 rounded-lg bg-amber-200/80 text-amber-900 text-xs font-semibold">
                    {copiedField === "content" ? "Đã copy" : "Copy"}
                  </button>
                </div>
                <p className="mt-1.5 text-amber-700">Ghi mã đơn gói này để admin xác nhận kích hoạt gói.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="bg-white border-t border-purple-100 p-4 pb-24" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="max-w-lg mx-auto flex gap-4 items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Tổng thanh toán</span>
            <span className="text-2xl font-bold text-slate-900">{formatPrice(amount)}</span>
            <span className="text-sm font-bold text-slate-500 ml-1">USDT</span>
            {paymentMethod === "banking" && usdtToVnd != null && (
              <span className="text-xs text-slate-500 block mt-0.5">≈ {formatVnd(amount * usdtToVnd)}</span>
            )}
          </div>
          <button
            onClick={handlePayment}
            disabled={processingStep !== "idle" || (paymentMethod === "wallet" && (!walletAddress || parseFloat(usdtBalance || "0") < amount))}
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl h-12 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingStep !== "idle" ? "Đang xử lý..." : paymentMethod === "banking" ? "Tôi đã chuyển khoản" : "Thanh toán"}
          </button>
        </div>
      </div>

      <TransactionProcessingModal
        isOpen={processingStep !== "idle"}
        step={processingStep}
        error={error}
        onClose={() => setProcessingStep("idle")}
        bankingSuccess={
          paymentMethod === "banking" && processingStep === "success"
            ? { orderId: purchaseId, transferContent: purchaseId }
            : undefined
        }
      />

      {error && processingStep === "idle" && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg text-sm max-w-md mx-4">
          {error}
        </div>
      )}
    </div>
  );
}
