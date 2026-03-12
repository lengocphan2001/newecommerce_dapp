"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import TransactionProcessingModal, { ProcessingStep } from "@/app/components/TransactionProcessingModal";
import { api } from "@/app/services/api";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits, getAddress } from "ethers";
import { useI18n } from "@/app/i18n/I18nProvider";

const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955"; // USDT BEP20 on BSC
const BSC_RPC = "https://bsc-dataseed.binance.org/";
const BSC_CHAIN_ID = "0x38"; // 56 in decimal

function getEthereum() {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum;
}

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
] as const;

// Helper function to poll transaction receipt
async function pollTransactionReceipt(txHash: string, timeout: number = 120000): Promise<any> {
  const provider = new JsonRpcProvider(BSC_RPC);
  const startTime = Date.now();
  let lastError: any = null;

  while (Date.now() - startTime < timeout) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        // Transaction found
        if (receipt.status === 1) {
          return receipt;
        }
        if (receipt.status === 0) {
          throw new Error("Transaction failed on blockchain");
        }
      }
      // Receipt is null - transaction not yet mined, continue polling
      lastError = null;
    } catch (error: any) {
      // If it's a transaction failure, throw immediately
      if (error.message && error.message.includes("failed")) {
        throw error;
      }
      // Store error but continue polling (might be network issue)
      lastError = error;
    }

    // Wait 3 seconds before next poll (slightly longer to avoid rate limiting)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // If we have a last error, throw it, otherwise timeout
  if (lastError) {
    throw new Error(`Transaction polling failed: ${lastError.message}`);
  }
  throw new Error("Transaction confirmation timeout - transaction may still be pending");
}

export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useShoppingCart();
  const router = useRouter();
  const { t } = useI18n();
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>("0");
  const [bnbBalance, setBnbBalance] = useState<string>("0");
  const [shippingAddress, setShippingAddress] = useState("");
  const [checkoutUser, setCheckoutUser] = useState<{ fullName?: string; phone?: string; address?: string; username?: string } | null>(null);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "banking">("wallet");
  const [bankingConfig, setBankingConfig] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankId?: string;
    qrImageUrl?: string;
    isEnabled: boolean;
    usdtPriceVnd?: number | null;
  } | null>(null);
  const [bankingOrderId, setBankingOrderId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"bankName" | "accountNumber" | "accountName" | "content" | null>(null);
  const [usdtToVnd, setUsdtToVnd] = useState<number | null>(null);

  const userWalletAddress = walletAddress || (typeof window !== "undefined" ? localStorage.getItem("walletAddress") : null);

  // USDT/VND rate for banking: use admin-set price when set, else fetch from CoinGecko
  useEffect(() => {
    if (paymentMethod !== "banking") return;
    const adminRate = bankingConfig?.usdtPriceVnd;
    if (typeof adminRate === "number" && adminRate > 0) {
      setUsdtToVnd(adminRate);
      console.log("adminRate", adminRate);
      return;
    }
    let cancelled = false;
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=vnd")
      .then((res) => res.json())
      .then((data: { tether?: { vnd?: number } }) => {
        if (cancelled) return;
        const rate = data?.tether?.vnd;
        if (typeof rate === "number" && rate > 0) setUsdtToVnd(rate);
      })
      .catch(() => { if (!cancelled) setUsdtToVnd(null); });
    return () => { cancelled = true; };
  }, [paymentMethod, bankingConfig?.usdtPriceVnd]);

  const copyToClipboard = async (text: string, field: "bankName" | "accountNumber" | "accountName" | "content") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  const downloadQrImage = async () => {
    if (!bankingConfig?.qrImageUrl) return;
    try {
      const res = await fetch(bankingConfig.qrImageUrl, { mode: "cors" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-chuyen-khoan.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(bankingConfig.qrImageUrl, "_blank");
    }
  };

  const finalTotal = totalAmount + shippingFee;

  /** Build VietQR image URL: bank info + amount (VND) + transfer content. addInfo max 25 chars. */
  const getVietQrUrl = (): string | null => {
    const bankId = bankingConfig?.bankId?.trim();
    const accountNumber = bankingConfig?.accountNumber?.trim().replace(/\s/g, "");
    const accountName = (bankingConfig?.accountName || "").trim();
    if (!bankId || !accountNumber) return null;
    const template = "compact2";
    const base = `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png`;
    const params = new URLSearchParams();
    if (usdtToVnd != null && usdtToVnd > 0 && finalTotal > 0) {
      const vndAmount = Math.round(finalTotal * usdtToVnd);
      if (vndAmount > 0) params.set("amount", String(vndAmount));
    }
    const addInfo = (checkoutUser?.username || "SHOPII").replace(/[^a-zA-Z0-9\s]/g, "").slice(0, 25).trim() || "SHOPII";
    params.set("addInfo", addInfo);
    if (accountName) params.set("accountName", accountName);
    return `${base}?${params.toString()}`;
  };
  const vietQrUrl = getVietQrUrl();

  useEffect(() => {
    loadWalletInfo();
    loadCheckoutUser();
    calculateShippingFee();
    api.getBankingConfig().then((c) => setBankingConfig(c)).catch(() => setBankingConfig(null));

    // Listen for address changes when returning from address page
    const handleStorageChange = () => {
      loadCheckoutUser();
    };
    window.addEventListener('focus', handleStorageChange);
    return () => window.removeEventListener('focus', handleStorageChange);
  }, [items]);

  const calculateShippingFee = async () => {
    try {
      let maxShippingFee = 0;

      // Fetch product details to get shippingFee and countries
      for (const item of items) {
        try {
          const product = await api.getProduct(item.productId);
          const fee = product.shippingFee ? Number(product.shippingFee) : 0;

          // If product has a shipping fee set
          if (fee > 0) {
            // Use the maximum shipping fee found among all items
            if (fee > maxShippingFee) {
              maxShippingFee = fee;
            }
          }
        } catch (error) {
          console.error(`Failed to fetch product ${item.productId}:`, error);
        }
      }

      setShippingFee(maxShippingFee);
    } catch (error) {
      console.error('Failed to calculate shipping fee:', error);
      setShippingFee(0);
    }
  };

  const loadCheckoutUser = async () => {
    try {
      let userBase = { fullName: "", phone: "", username: "" as string | undefined };
      // 1. Try API for basic info (includes Binary ID / username)
      if (typeof api !== 'undefined') {
        try {
          const info = await api.getReferralInfo();
          userBase = {
            fullName: info.fullName || "Nguyễn Văn A",
            phone: info.phone || info.phoneNumber || "+84 912 345 678",
            username: info.username
          };
        } catch (e) {
          userBase = { fullName: "Nguyễn Văn A", phone: "+84 912 345 678", username: undefined };
        }
      }

      // 2. Check for "Selected Address" overrides from AddressPage (which saves to shippingUser/shippingAddress)
      const storedUser = localStorage.getItem("shippingUser");
      const storedAddress = localStorage.getItem("shippingAddress");

      if (storedUser && storedAddress) {
        const parsedUser = JSON.parse(storedUser);
        setCheckoutUser({
          fullName: parsedUser.name || userBase.fullName,
          phone: parsedUser.phone || userBase.phone,
          address: storedAddress,
          username: parsedUser.username ?? userBase.username
        });
        setShippingAddress(storedAddress);
      } else {
        const localAddr = localStorage.getItem("userAddress");
        setCheckoutUser({
          ...userBase,
          address: localAddr || ""
        });
        setShippingAddress(localAddr || "");
      }
    } catch (err) {
      // Error handled in UI
    }
  };


  const loadUsdtBep20Balance = async (address: string) => {
    try {
      // Use JsonRpcProvider to read BEP-20 USDT balance on BSC (same as profile page)
      const provider = new JsonRpcProvider(BSC_RPC);
      const contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
      const [decimals, balance] = await Promise.all([
        contract.decimals(),
        contract.balanceOf(getAddress(address)),
      ]);
      const formatted = formatUnits(balance as bigint, Number(decimals));
      setUsdtBalance(formatted);

      // Cache balance
      try {
        localStorage.setItem("usdtBep20Balance", formatted);
        localStorage.setItem("usdtBep20UpdatedAt", String(Date.now()));
      } catch {
        // ignore
      }
    } catch (error) {
      setUsdtBalance("0");
    }
  };

  const loadWalletInfo = async () => {
    try {
      // First, try to load cached balance
      try {
        const cached = localStorage.getItem("usdtBep20Balance");
        if (cached) setUsdtBalance(cached);
      } catch {
        // ignore
      }

      const eth = getEthereum();
      if (!eth) {
        // Try to get wallet address from localStorage
        const storedAddr = localStorage.getItem("walletAddress");
        if (storedAddr) {
          setWalletAddress(storedAddr);
          await loadUsdtBep20Balance(storedAddr);
        } else {
          setError("Vui lòng cài đặt ví Shopii hoặc ví tương thích");
        }
        return;
      }

      // Request account access if needed
      try {
        await eth.request({ method: "eth_requestAccounts" });
      } catch (e) {
        // User rejected, try localStorage
        const storedAddr = localStorage.getItem("walletAddress");
        if (storedAddr) {
          setWalletAddress(storedAddr);
          await loadUsdtBep20Balance(storedAddr);
        }
        return;
      }

      const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
      if (accounts && accounts.length > 0) {
        const address = accounts[0];
        setWalletAddress(address);
        await loadUsdtBep20Balance(address);
      } else {
        // Try localStorage
        const storedAddr = localStorage.getItem("walletAddress");
        if (storedAddr) {
          setWalletAddress(storedAddr);
          await loadUsdtBep20Balance(storedAddr);
        }
      }
    } catch (err: any) {
      // Try localStorage as fallback
      try {
        const storedAddr = localStorage.getItem("walletAddress");
        if (storedAddr) {
          setWalletAddress(storedAddr);
          await loadUsdtBep20Balance(storedAddr);
        }
      } catch {
        setError(err.message || "Không thể kết nối ví Shopii");
      }
    }
  };

  const connectWallet = async () => {
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Vui lòng cài đặt ví Shopii");
        return;
      }

      // Request account access
      await eth.request({ method: "eth_requestAccounts" });

      // Check if already on BSC, if not, switch
      const chainId = await eth.request({ method: "eth_chainId" }) as string;

      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BSC_CHAIN_ID }],
          });
        } catch (switchError: any) {
          // Chain not added, add it
          if (switchError.code === 4902 || switchError.code === -32603) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: BSC_CHAIN_ID,
                  chainName: "Binance Smart Chain",
                  nativeCurrency: {
                    name: "BNB",
                    symbol: "BNB",
                    decimals: 18,
                  },
                  rpcUrls: ["https://bsc-dataseed.binance.org/"],
                  blockExplorerUrls: ["https://bscscan.com/"],
                },
              ],
            });
          } else {
            throw switchError;
          }
        }
      }

      await loadWalletInfo();
    } catch (err: any) {
      setError(err.message || "Không thể kết nối ví Shopii");
    }
  };

  const handleBankingOrder = async () => {
    if (!shippingAddress.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng");
      return;
    }
    setProcessingStep("creating_order");
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Vui lòng đăng nhập");
      }
      const orderData = await api.createOrder(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          properties: item.properties,
        })),
        undefined,
        shippingAddress,
        "banking"
      );
      setBankingOrderId(orderData.id);
      setProcessingStep("success");
      clearCart();
      setTimeout(() => {
        router.push(`/home/orders?success=true&orderId=${orderData.id}&banking=1`);
      }, 4000); // longer so user can copy transfer content
    } catch (err: any) {
      setError(err.message || "Đặt hàng thất bại");
      setProcessingStep("error");
    }
  };

  const handlePayment = async () => {
    if (paymentMethod === "banking") {
      await handleBankingOrder();
      return;
    }
    if (!walletAddress) {
      setError("Vui lòng kết nối ví");
      return;
    }

    const finalTotal = totalAmount + shippingFee;
    if (parseFloat(usdtBalance || "0") < finalTotal) {
      setError("Số dư USDT không đủ");
      return;
    }

    if (!shippingAddress.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng");
      return;
    }

    setProcessingStep("confirming");
    setError("");

    let orderIdForRedirect: string | undefined;
    try {
      const eth = getEthereum();
      if (!eth) throw new Error("Ví không khả dụng");

      // Ensure wallet is on BSC network
      const chainId = await eth.request({ method: "eth_chainId" }) as string;
      if (chainId !== BSC_CHAIN_ID) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BSC_CHAIN_ID }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await eth.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: BSC_CHAIN_ID,
                  chainName: "Binance Smart Chain",
                  nativeCurrency: {
                    name: "BNB",
                    symbol: "BNB",
                    decimals: 18,
                  },
                  rpcUrls: ["https://bsc-dataseed.binance.org/"],
                  blockExplorerUrls: ["https://bscscan.com/"],
                },
              ],
            });
          } else {
            throw new Error("Vui lòng chuyển sang mạng BSC để thanh toán");
          }
        }
      }

      const provider = new BrowserProvider(eth as any);
      const signer = await provider.getSigner();

      // Get decimals... (logic unchanged)
      let decimals = 18;
      try {
        const cachedDecimals = localStorage.getItem("usdtBep20Decimals");
        if (cachedDecimals) {
          decimals = parseInt(cachedDecimals, 10);
        } else {
          const readProvider = new JsonRpcProvider(BSC_RPC);
          const readContract = new Contract(getAddress(USDT_BSC), ERC20_ABI, readProvider);
          try {
            decimals = Number(await readContract.decimals());
            localStorage.setItem("usdtBep20Decimals", String(decimals));
          } catch (e) {
          }
        }
      } catch (e) {
      }

      const usdtContract = new Contract(USDT_BSC, ERC20_ABI, signer);
      const finalTotal = totalAmount + shippingFee;

      // Ensure we have a valid decimal string and valid decimals
      // Ensure we have a valid decimal string and valid decimals.
      // Fix: Round to 4 decimals to avoid floating point precision issues (e.g. 0.6000000000000001)
      const formattedTotal = parseFloat(finalTotal.toFixed(4)).toString();
      const amount = parseUnits(formattedTotal, decimals);

      // Use a fallback address if env is missing to prevent sending to 0x0
      const recipientAddress = process.env.NEXT_PUBLIC_PAYMENT_WALLET;

      if (!recipientAddress || recipientAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Cửa hàng chưa thiết lập ví nhận thanh toán (NEXT_PUBLIC_PAYMENT_WALLET)");
      }

      // 1. Create Order (PENDING)
      const orderStartTime = Date.now();
      setProcessingStep("creating_order");

      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Vui lòng đăng nhập");
      }

      // Create order WITHOUT transaction hash first
      const orderData = await api.createOrder(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          properties: item.properties,
        })),
        undefined, // No transaction hash yet
        shippingAddress
      );
      orderIdForRedirect = orderData.id;
      console.log("Order created pending:", orderData.id);

      // 2. Send Transaction
      // Use standard contract method with explicit gas limit
      const transferTx = await usdtContract.transfer(recipientAddress, amount, { gasLimit: 150000 });
      const transactionHash = transferTx.hash;
      const txStartTime = Date.now();

      // 3. Wait for confirmation
      setProcessingStep("processing");

      // Artificial delay to ensure user sees the processing state
      await new Promise(resolve => setTimeout(resolve, 2000));

      let receipt;
      try {
        // Try wait() with only 1 confirmation (faster) and reasonable timeout
        const waitStartTime = Date.now();
        // Wait for only 1 confirmation to speed up (BSC is fast, 1 confirmation is usually enough)
        const waitPromise = transferTx.wait(1); // Only wait for 1 confirmation
        const waitTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Wait timeout")), 30000) // 30 seconds should be enough for BSC
        );

        receipt = await Promise.race([waitPromise, waitTimeout]) as any;
        const waitDuration = Date.now() - waitStartTime;
      } catch (waitError: any) {
        // Wait() timed out or failed, use polling as fallback
        const pollStartTime = Date.now();
        receipt = await pollTransactionReceipt(transactionHash, 60000); // Reduced to 60s
        const pollDuration = Date.now() - pollStartTime;
      }

      const totalTxTime = Date.now() - txStartTime;

      if (!receipt || !receipt.hash) {
        throw new Error("Không thể xác nhận giao dịch");
      }

      // Verify transaction status
      const status = receipt.status;
      const isSuccess = status === 1 || status === "0x1" || status === true;
      if (!isSuccess) {
        throw new Error("Giao dịch thất bại trên blockchain");
      }

      // 4. Confirm Payment for the Order
      setProcessingStep("creating_order"); // Reuse this step or add a new one like "confirming_payment"

      await api.confirmPayment(orderData.id, transactionHash);

      const orderDuration = Date.now() - orderStartTime;

      // 5. Success
      setProcessingStep("success");
      clearCart();

      // Wait a bit before redirecting so user sees the success message
      setTimeout(() => {
        router.push(`/home/orders?success=true&orderId=${orderData.id}`);
      }, 1500); // Reduced from 2000ms to 1500ms

    } catch (err: any) {

      // Check for user rejection
      if (err.code === "ACTION_REJECTED" || err.code === 4001 || err?.info?.error?.code === 4001 || (err.message && err.message.includes("rejected"))) {
        setError("Bạn đã hủy giao dịch");
      } else if (err.message === "CONFIRM_TIMEOUT") {
        setError("Xác nhận thanh toán đang quá lâu. Vui lòng kiểm tra đơn hàng của bạn.");
        setProcessingStep("error");
        // Still redirect to orders so user can see the order (may be confirmed or pending)
        const id = orderIdForRedirect;
        setTimeout(() => {
          router.push(id ? `/home/orders?orderId=${id}` : "/home/orders");
        }, 3000);
        return;
      } else {
        setError(err.message || "Thanh toán thất bại");
      }

      setProcessingStep("error");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(price);
  };

  const formatVnd = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance || "0");
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(num);
  };

  const shortAddress = (address?: string | null) => {
    if (!address) return "0x1234...abcd";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-background-light font-display text-text-main antialiased flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-purple-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => router.back()}
          className="size-10 flex items-center justify-center rounded-full bg-purple-50 hover:bg-purple-100 text-slate-600 transition active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
        </button>
        <h1 className="text-lg font-bold text-text-main tracking-tight">{t("checkout")}</h1>
        <div className="size-10"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-6 space-y-6 max-w-lg mx-auto w-full">
        {/* Section 1: Shipping Information */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs font-bold shadow-sm ring-2 ring-purple-100">1</span>
            <h2 className="text-base font-bold text-slate-700">{t("shippingInfo")}</h2>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100 group transition-all hover:border-primary/30">
            <div className="flex gap-4">
              <div className="shrink-0 pt-1">
                <div className="size-10 rounded-full bg-purple-50 flex items-center justify-center text-primary border border-purple-100">
                  <span className="material-symbols-outlined">location_on</span>
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-bold text-slate-900 text-lg">{checkoutUser?.fullName || "Nguyễn Văn A"}</p>
                  <button
                    onClick={() => router.push("/home/profile/address")}
                    className="text-xs font-semibold text-primary hover:text-primary-dark px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 transition"
                  >
                    {t("change")}
                  </button>
                </div>
                <p className="text-sm text-text-sub font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">call</span>
                  {checkoutUser?.phone || "+84 912 345 678"}
                </p>
                <p className="text-sm text-text-sub leading-relaxed pt-1">
                  {shippingAddress}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Payment Method */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs font-bold shadow-sm ring-2 ring-purple-100">2</span>
            <h2 className="text-base font-bold text-slate-700">{t("paymentMethod")}</h2>
          </div>
          {/* Tabs: Ví (USDT) | Chuyển khoản */}
          <div className="flex rounded-xl border-2 border-purple-100 bg-white p-1 overflow-hidden">
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
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="size-10 rounded-full bg-gray-100 bg-cover bg-center border border-slate-200" style={{
                      backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDtLWBC8wB037R9cWqWUH1eRY-ZY0HW_ddkkNGLjliyJNCZr49lS45qsJjELi5cirrppCzmZgrDIhI8aORjjiyBrBVAqJRd2s7jFzu5mOXYZKpmTCn5O4mdZiZWzcv4YdMcNWHXcBdlf_34FZwIIrT9ET0rhg8kZ8bOXhDfIUMxCSC2PyvuUo82k9c4lHqNsSNXhp7q5P_YE71hUiSZHvzfNw0S7I8eYnG0nLp9FZYUMUr7pOSpjkIx-rBa831cVmWsY4iYHfEdU4c')"
                    }}></div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 border-2 border-white rounded-full p-[2px] shadow-sm">
                      <span className="material-symbols-outlined text-white text-[10px] font-bold block">link</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{t("paymentMethodSafePal")}</p>
                    <p className="text-xs text-text-sub font-medium font-mono bg-slate-100 px-1 rounded inline-block mt-0.5">
                      {shortAddress(walletAddress)}
                    </p>
                  </div>
                </div>
                {walletAddress ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-md border border-green-100">
                    <div className="size-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    {t("connected")}
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-md hover:bg-primary-dark transition"
                  >
                    {t("connect")}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-text-sub px-1 uppercase tracking-wider">{t("paymentAsset")}</p>
                <div className="flex items-center p-3.5 rounded-xl border-2 border-primary bg-purple-50">
                  <div className="size-11 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100">
                    <span className="material-symbols-outlined text-[22px]">attach_money</span>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 text-base">USDT</p>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">BEP20</span>
                    </div>
                    <p className="text-xs text-text-sub mt-0.5">Số dư: <span className="font-semibold text-slate-700">{formatBalance(usdtBalance)}</span></p>
                  </div>
                  <div className="size-5 rounded-full border-[1.5px] border-primary bg-primary flex items-center justify-center">
                    <div className="size-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {paymentMethod === "banking" && !bankingConfig?.isEnabled && (
            <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100 text-center text-slate-500 text-sm">
              Phương thức chuyển khoản tạm thời không khả dụng. Vui lòng chọn thanh toán bằng Ví (USDT).
            </div>
          )}
          {paymentMethod === "banking" && bankingConfig && bankingConfig.isEnabled && (
            <div className="bg-white p-4 rounded-2xl shadow-card border border-purple-100 space-y-4">
              <p className="text-sm text-slate-600">Chuyển khoản đến tài khoản sau. Đơn hàng sẽ ở trạng thái chờ duyệt cho đến khi admin xác nhận đã nhận tiền.</p>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-500 font-medium mb-0.5">Số tiền chuyển khoản</p>
                <p className="font-bold text-slate-900 text-lg">{formatPrice(finalTotal)} USDT</p>
                {usdtToVnd != null && (
                  <p className="text-sm text-slate-600 mt-0.5">≈ {formatVnd(finalTotal * usdtToVnd)} </p>
                )}
                {usdtToVnd == null && paymentMethod === "banking" && (
                  <p className="text-xs text-slate-400 mt-0.5">Đang lấy tỷ giá USDT/VND...</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-text-sub font-medium shrink-0">Ngân hàng</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 truncate">{bankingConfig.bankName || "—"}</span>
                    {bankingConfig.bankName && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bankingConfig.bankName, "bankName")}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                      >
                        {copiedField === "bankName" ? "Đã copy" : <><span className="material-symbols-outlined text-[14px]">content_copy</span> Copy</>}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-text-sub font-medium shrink-0">Số tài khoản</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold font-mono text-slate-900 truncate">{bankingConfig.accountNumber || "—"}</span>
                    {bankingConfig.accountNumber && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bankingConfig.accountNumber, "accountNumber")}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                      >
                        {copiedField === "accountNumber" ? "Đã copy" : <><span className="material-symbols-outlined text-[14px]">content_copy</span> Copy</>}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-text-sub font-medium shrink-0">Chủ tài khoản</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 uppercase truncate">{bankingConfig.accountName || "—"}</span>
                    {bankingConfig.accountName && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(bankingConfig.accountName, "accountName")}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                      >
                        {copiedField === "accountName" ? "Đã copy" : <><span className="material-symbols-outlined text-[14px]">content_copy</span> Copy</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center pt-2">
                {vietQrUrl ? (
                  <>
                    <span className="text-xs text-text-sub font-medium mb-2">
                      Quét mã QR để chuyển khoản (số tiền + nội dung đã điền sẵn)
                    </span>
                    <img src={vietQrUrl} alt="VietQR chuyển khoản" className="w-64 h-64 min-w-[256px] min-h-[256px] object-contain rounded-lg border border-slate-200 bg-white" />
                    <a
                      href={vietQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Mở / tải ảnh QR
                    </a>
                  </>
                ) : bankingConfig.qrImageUrl ? (
                  <>
                    <span className="text-xs text-text-sub font-medium mb-2">Quét mã QR để chuyển khoản</span>
                    <img src={bankingConfig.qrImageUrl} alt="QR chuyển khoản" className="w-64 h-64 min-w-[256px] min-h-[256px] object-contain rounded-lg border border-slate-200 bg-white" />
                    <button
                      type="button"
                      onClick={downloadQrImage}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      Tải ảnh QR
                    </button>
                  </>
                ) : (
                  <div className="text-center py-4 px-3 rounded-lg bg-slate-100 border border-slate-200 w-full max-w-sm">
                    <p className="text-sm font-medium text-slate-700 mb-1">Chưa có mã QR</p>
                    <p className="text-xs text-slate-500">
                      Để hiển thị mã QR quét chuyển khoản, Admin cần vào <strong>Banking Settings</strong> → chọn <strong>VietQR Bank</strong> (hoặc tải ảnh QR lên) rồi lưu.
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-2">
                <strong>Nội dung chuyển khoản (Binary ID của bạn):</strong>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <code className="flex-1 min-w-0 break-all font-mono bg-amber-100/80 px-2 py-1.5 rounded text-slate-800">
                    {checkoutUser?.username || "Đăng nhập để hiện Binary ID"}
                  </code>
                  {checkoutUser?.username && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(checkoutUser.username!, "content")}
                      className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-200/80 text-amber-900 text-xs font-semibold hover:bg-amber-300/80 transition"
                    >
                      {copiedField === "content" ? "Đã copy" : <><span className="material-symbols-outlined text-[14px]">content_copy</span> Copy</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Payment Details */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs font-bold shadow-sm ring-2 ring-purple-100">3</span>
            <h2 className="text-base font-bold text-slate-700">{t("paymentDetails")}</h2>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-card border border-purple-100 space-y-3.5">
            <div className="flex justify-between text-sm items-center">
              <span className="text-text-sub font-medium">{t("productPrice")}</span>
              <span className="font-bold text-slate-900">{formatPrice(totalAmount)} USDT</span>
            </div>
            {shippingFee > 0 && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-text-sub font-medium">{t("shippingFee")}</span>
                <span className="font-bold text-slate-900">{formatPrice(shippingFee)} USDT</span>
              </div>
            )}
            {paymentMethod === "banking" && usdtToVnd != null && (
              <>
                <div className="border-t border-slate-100 pt-3 mt-1">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-text-sub font-medium">Tổng thanh toán (VND)</span>
                    <span className="font-bold text-slate-900">{formatVnd(finalTotal * usdtToVnd)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-purple-100 shadow-[0_-8px_30px_rgba(139,92,246,0.06)] p-4 pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="max-w-lg mx-auto flex gap-4 items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-text-sub font-medium mb-0.5">{t("totalPayment")}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatPrice(finalTotal)}</span>
              <span className="text-sm font-bold text-slate-500">USDT</span>
            </div>
            {paymentMethod === "banking" && usdtToVnd != null && (
              <span className="text-xs text-slate-500 mt-0.5">≈ {formatVnd(finalTotal * usdtToVnd)}</span>
            )}
          </div>
          <button
            onClick={handlePayment}
            disabled={
              processingStep !== "idle"
              || (paymentMethod === "wallet" && (!walletAddress || parseFloat(usdtBalance || "0") < finalTotal))
            }
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl h-12 flex items-center justify-center gap-2 shadow-float transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              {processingStep !== "idle"
                ? t("processingPayment")
                : paymentMethod === "banking"
                  ? "Đặt hàng"
                  : t("confirmPurchase")}
            </span>
            {processingStep === "idle" && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {/* Modal Processing */}
      <TransactionProcessingModal
        isOpen={processingStep !== "idle"}
        step={processingStep}
        error={error}
        onClose={() => setProcessingStep("idle")}
        bankingSuccess={
          processingStep === "success" && bankingOrderId
            ? {
                orderId: bankingOrderId,
                transferContent: checkoutUser?.username || "",
              }
            : undefined
        }
      />

      {/* Error Message (for non-modal errors or if modal is closed) */}
      {error && processingStep === "idle" && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg text-sm max-w-md mx-4">
          {error}
        </div>
      )}
    </div>
  );
}
