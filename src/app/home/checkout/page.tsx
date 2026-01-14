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
  const [checkoutUser, setCheckoutUser] = useState<{ fullName?: string; phone?: string; address?: string } | null>(null);
  const [shippingFee, setShippingFee] = useState<number>(0);

  useEffect(() => {
    loadWalletInfo();
    loadCheckoutUser();
    calculateShippingFee();
    
    // Listen for address changes when returning from address page
    const handleStorageChange = () => {
        loadCheckoutUser();
    };
    window.addEventListener('focus', handleStorageChange);
    return () => window.removeEventListener('focus', handleStorageChange);
  }, [items]);

  const calculateShippingFee = async () => {
    try {
      let totalShippingFee = 0;
      
      // Fetch product details to get shippingFee and countries
      for (const item of items) {
        try {
          const product = await api.getProduct(item.productId);
          const productCountries = product.countries || [];
          
          // If product is available in USA and has shipping fee
          if (Array.isArray(productCountries) && productCountries.includes('USA') && product.shippingFee) {
            totalShippingFee += (product.shippingFee || 0) * item.quantity;
          }
        } catch (error) {
          // Skip if product fetch fails
          console.error(`Failed to fetch product ${item.productId}:`, error);
        }
      }
      
      setShippingFee(totalShippingFee);
    } catch (error) {
      console.error('Failed to calculate shipping fee:', error);
      setShippingFee(0);
    }
  };

  const loadCheckoutUser = async () => {
    try {
        let userBase = { fullName: "", phone: "" };
        // 1. Try API for basic info
        if (typeof api !== 'undefined') {
            try {
                const info = await api.getReferralInfo();
                userBase = { 
                    fullName: info.fullName || "Nguyễn Văn A", 
                    phone: info.phone || info.phoneNumber || "+84 912 345 678"
                };
            } catch(e) {
                // Basic fallback
                userBase = { fullName: "Nguyễn Văn A", phone: "+84 912 345 678" };
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
                address: storedAddress
            });
            setShippingAddress(storedAddress);
        } else {
             // Fallback to what we have or userAddress
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
          setError("Vui lòng cài đặt ví SafePalMall hoặc ví tương thích");
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
        setError(err.message || "Không thể kết nối ví SafePalMall");
      }
    }
  };

  const connectWallet = async () => {
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Vui lòng cài đặt ví SafePalMall");
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
      setError(err.message || "Không thể kết nối ví SafePalMall");
    }
  };

  // ... (handlePayment and remaining functions)

  // ... inside render:
  // <p className="font-bold text-slate-900 text-lg">{checkoutUser?.fullName || "Nguyễn Văn A"}</p>
  // {checkoutUser?.phone || "+84 912 345 678"}

  const handlePayment = async () => {
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
      const amount = parseUnits(finalTotal.toFixed(decimals), decimals);
      const recipientAddress = process.env.NEXT_PUBLIC_PAYMENT_WALLET || "0x0000000000000000000000000000000000000000";

      // 1. Send Transaction
      const transferTx = await usdtContract.transfer(recipientAddress, amount);
      const transactionHash = transferTx.hash;
      const txStartTime = Date.now();
      
      // 2. Wait for confirmation - try wait() first with only 1 confirmation for speed
      setProcessingStep("processing");
      
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
      

      // 3. Create Order
      const orderStartTime = Date.now();
      setProcessingStep("creating_order");
      
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Vui lòng đăng nhập");
      }

      const orderData = await api.createOrder(
        items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        transactionHash,
        shippingAddress
      );

      const orderDuration = Date.now() - orderStartTime;

      // 4. Success
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
      } else {
         setError(err.message || "Thanh toán thất bại");
      }
      
      setProcessingStep("error");
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 5,
      maximumFractionDigits: 18,
    }).format(price);
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

  // Final total (shippingFee is already calculated in state)
  const finalTotal = totalAmount + shippingFee;

  return (
    <div className="bg-background-light font-display text-text-main antialiased flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-blue-100 px-4 py-3 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => router.back()}
          className="size-10 flex items-center justify-center rounded-full bg-blue-50 hover:bg-blue-100 text-slate-600 transition active:scale-95"
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
            <span className="flex items-center justify-center size-6 rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm ring-2 ring-blue-100">1</span>
            <h2 className="text-base font-bold text-slate-700">{t("shippingInfo")}</h2>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-card border border-blue-100 group transition-all hover:border-blue-600/30">
            <div className="flex gap-4">
              <div className="shrink-0 pt-1">
                <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 border border-blue-100">
                  <span className="material-symbols-outlined">location_on</span>
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-bold text-slate-900 text-lg">{checkoutUser?.fullName || "Nguyễn Văn A"}</p>
                  <button 
                    onClick={() => router.push("/home/profile/address")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition"
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
            <span className="flex items-center justify-center size-6 rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm ring-2 ring-blue-100">2</span>
            <h2 className="text-base font-bold text-slate-700">{t("paymentMethod")}</h2>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-card border border-blue-100 flex items-center justify-between">
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
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 transition"
              >
                {t("connect")}
              </button>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold text-text-sub px-1 uppercase tracking-wider">{t("paymentAsset")}</p>
            <div className="flex items-center p-3.5 rounded-xl border-2 border-blue-600 bg-blue-50">
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
              <div className="size-5 rounded-full border-[1.5px] border-blue-600 bg-blue-600 flex items-center justify-center">
                <div className="size-2 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Payment Details */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm ring-2 ring-blue-100">3</span>
            <h2 className="text-base font-bold text-slate-700">{t("paymentDetails")}</h2>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-card border border-blue-100 space-y-3.5">
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
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-blue-100 shadow-[0_-8px_30px_rgba(37,99,235,0.06)] p-4 pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-lg mx-auto flex gap-4 items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-text-sub font-medium mb-0.5">{t("totalPayment")}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatPrice(finalTotal)}</span>
                <span className="text-sm font-bold text-slate-500">USDT</span>
              </div>
            </div>
            <button 
              onClick={handlePayment}
              disabled={processingStep !== "idle" || !walletAddress || parseFloat(usdtBalance || "0") < finalTotal}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-12 flex items-center justify-center gap-2 shadow-float transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{processingStep !== "idle" ? t("processingPayment") : t("confirmPurchase")}</span>
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
