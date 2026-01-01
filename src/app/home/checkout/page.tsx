"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import { api } from "@/app/services/api";
import { BrowserProvider, Contract, JsonRpcProvider, formatUnits, parseUnits, getAddress } from "ethers";

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

export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useShoppingCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>("0");
  const [shippingAddress, setShippingAddress] = useState("");

  useEffect(() => {
    loadWalletInfo();
  }, []);

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
      console.error("Error loading USDT balance:", error);
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
          setError("Vui lòng cài đặt ví SafePal hoặc ví tương thích");
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
      console.error("Error loading wallet info:", err);
      // Try localStorage as fallback
      try {
        const storedAddr = localStorage.getItem("walletAddress");
        if (storedAddr) {
          setWalletAddress(storedAddr);
          await loadUsdtBep20Balance(storedAddr);
        }
      } catch {
        setError(err.message || "Không thể kết nối ví SafePal");
      }
    }
  };

  const connectWallet = async () => {
    try {
      const eth = getEthereum();
      if (!eth) {
        setError("Vui lòng cài đặt ví SafePal");
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
      setError(err.message || "Không thể kết nối ví SafePal");
    }
  };

  const handlePayment = async () => {
    if (!walletAddress) {
      setError("Vui lòng kết nối ví");
      return;
    }

    if (parseFloat(usdtBalance || "0") < totalAmount) {
      setError("Số dư USDT không đủ");
      return;
    }

    if (!shippingAddress.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng");
      return;
    }

    setLoading(true);
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

      // Get decimals from cache or use default (USDT BEP20 on BSC has 18 decimals)
      let decimals = 18;
      try {
        const cachedDecimals = localStorage.getItem("usdtBep20Decimals");
        if (cachedDecimals) {
          decimals = parseInt(cachedDecimals, 10);
        } else {
          // Try to get from contract using JsonRpcProvider (read-only, more reliable)
          const readProvider = new JsonRpcProvider(BSC_RPC);
          const readContract = new Contract(getAddress(USDT_BSC), ERC20_ABI, readProvider);
          try {
            decimals = Number(await readContract.decimals());
            localStorage.setItem("usdtBep20Decimals", String(decimals));
          } catch (e) {
            // If fails, use default 18 (USDT BEP20 on BSC has 18 decimals)
            console.warn("Could not get decimals from contract, using default 18");
          }
        }
      } catch (e) {
        console.warn("Error getting decimals, using default 18", e);
      }

      // Get USDT contract for transfer
      const usdtContract = new Contract(USDT_BSC, ERC20_ABI, signer);
      // Format amount with proper decimals
      const amount = parseUnits(totalAmount.toFixed(decimals), decimals);

      // TODO: Replace with your platform's BSC wallet address for receiving USDT
      const recipientAddress = process.env.NEXT_PUBLIC_PAYMENT_WALLET || "0x0000000000000000000000000000000000000000";

      // Transfer USDT (BEP20) directly - no approval needed for direct transfer
      const transferTx = await usdtContract.transfer(recipientAddress, amount);
      const receipt = await transferTx.wait();
      const transactionHash = receipt.hash;

      // Create order with transaction hash
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

      // Clear cart and redirect
      clearCart();
      router.push(`/home/orders?success=true&orderId=${orderData.id}`);
    } catch (err: any) {
      setError(err.message || "Thanh toán thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navShopping" />
      <main className="flex-1 pb-28">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900">
            Thanh toán
          </h2>

          {/* Order Summary */}
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-zinc-900">Đơn hàng</h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-zinc-800">
                    {item.productName} x {item.quantity}
                  </span>
                  <span className="font-semibold text-zinc-900">
                    ${(item.price * item.quantity).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-base font-semibold text-zinc-900">Tổng cộng:</span>
              <span className="text-xl font-bold text-blue-600">
                ${totalAmount.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </span>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-zinc-900">Địa chỉ giao hàng</h3>
            <textarea
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Nhập địa chỉ giao hàng..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
            />
          </div>

          {/* Wallet Info */}
          <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-base font-semibold text-zinc-900">Ví thanh toán</h3>
            {walletAddress ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700">Địa chỉ ví:</span>
                  <span className="font-mono text-xs font-semibold text-zinc-900">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700">Số dư USDT:</span>
                  <span className="font-bold text-zinc-900">
                    {parseFloat(usdtBalance || "0").toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}{" "}
                    <span className="font-semibold text-blue-600">USDT</span>
                  </span>
                </div>
                {parseFloat(usdtBalance || "0") < totalAmount && (
                  <p className="text-sm font-medium text-red-600">
                    Số dư không đủ. Cần {totalAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })} USDT
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-700">
                  Vui lòng kết nối ví SafePal để thanh toán bằng USDT (BEP20)
                </p>
                <button
                  onClick={connectWallet}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Kết nối ví SafePal
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={loading || !walletAddress || parseFloat(usdtBalance || "0") < totalAmount}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
          >
            {loading ? "Đang xử lý..." : "Thanh toán bằng USDT (BEP20)"}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Thanh toán bằng USDT (BEP20) trên BSC. Đơn hàng sẽ được admin duyệt sau khi thanh toán thành công.
          </p>
        </div>
      </main>
    </div>
  );
}
