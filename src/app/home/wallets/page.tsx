"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Contract, JsonRpcProvider, formatUnits, getAddress, BrowserProvider } from "ethers";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

function getEthereum() {
  if (typeof window === "undefined") return undefined;
  return (window as any).ethereum;
}

const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC = "https://bsc-dataseed.binance.org/";
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"] as const;

interface Asset {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  color: string;
  icon?: string;
}

interface Transaction {
  id: string;
  type: 'commission' | 'order' | 'deposit' | 'withdraw';
  title: string;
  amount: number;
  status: string;
  date: string;
  icon: string;
  iconColor: string;
}

export default function WalletsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [usdtBalance, setUsdtBalance] = useState<string>("0");
  const [isLoadingUSDT, setIsLoadingUSDT] = useState<boolean>(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchWalletData();
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const data = await api.getOrders();
      const ordersList = Array.isArray(data) ? data : (data?.data || []);
      setOrders(ordersList);
    } catch (err: any) {
      // Check if it's an authentication error and redirect
      if (handleAuthError(err, router)) {
        return; // Redirect is happening
      }
      // User might not be logged in, ignore other errors
    }
  };

  const loadUsdtBep20Balance = async (address: string) => {
    setIsLoadingUSDT(true);
    try {
      // Validate address
      if (!address || !getAddress(address)) {
        throw new Error("Invalid wallet address");
      }

      let provider: JsonRpcProvider | BrowserProvider;
      let contract: Contract;

      // Try to use SafePal provider first (if available)
      const ethereum = getEthereum();
      if (ethereum) {
        try {
          // Use SafePal provider
          const browserProvider = new BrowserProvider(ethereum);
          const network = await browserProvider.getNetwork();
          
          // Ensure we're on BSC (chainId: 56 = 0x38)
          if (Number(network.chainId) !== 56) {
            // If not on BSC, fallback to RPC
            provider = new JsonRpcProvider(BSC_RPC);
          } else {
            provider = browserProvider;
          }
          
          contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
        } catch (providerError) {
          // Fallback to RPC if SafePal provider fails
          provider = new JsonRpcProvider(BSC_RPC);
          contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
        }
      } else {
        // Use public RPC as fallback
        provider = new JsonRpcProvider(BSC_RPC);
        contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
      }

      // Get balance and decimals
      const [decimals, balance] = await Promise.all([
        contract.decimals(),
        contract.balanceOf(getAddress(address)),
      ]);
      
      const formatted = formatUnits(balance as bigint, Number(decimals));
      setUsdtBalance(formatted);
      
      // Cache the balance
      try {
        localStorage.setItem("usdtBep20Balance", formatted);
        localStorage.setItem("usdtBep20UpdatedAt", String(Date.now()));
      } catch {
        // ignore localStorage errors
      }
    } catch (error) {
      console.error("Error loading USDT balance:", error);
      // Try to use cached balance as fallback
      try {
        const cached = localStorage.getItem("usdtBep20Balance");
        const cachedTime = localStorage.getItem("usdtBep20UpdatedAt");
        // Only use cache if it's less than 5 minutes old
        if (cached && cachedTime) {
          const age = Date.now() - parseInt(cachedTime, 10);
          if (age < 5 * 60 * 1000) { // 5 minutes
            setUsdtBalance(cached);
          } else {
            setUsdtBalance("0");
          }
        } else {
          setUsdtBalance("0");
        }
      } catch {
        setUsdtBalance("0");
      }
    } finally {
      setIsLoadingUSDT(false);
    }
  };

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      
      // Get wallet address from localStorage
      if (typeof window !== "undefined") {
        const storedAddr = localStorage.getItem("walletAddress") || "";
        setWalletAddress(storedAddr);
        
        // Try to load cached USDT balance first
        try {
          const cached = localStorage.getItem("usdtBep20Balance");
          if (cached) setUsdtBalance(cached);
        } catch {
          // ignore
        }
        
        // Load USDT balance from blockchain
        if (storedAddr) {
          loadUsdtBep20Balance(storedAddr);
        }
      }

      // Get referral info for affiliate balance
      try {
        const info = await api.getReferralInfo();
        setReferralInfo(info);
      } catch (err: any) {
        // Check if it's an authentication error and redirect
        if (handleAuthError(err, router)) {
          return; // Redirect is happening
        }
        // User might not be logged in or no referral info, ignore other errors
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: string | number) => {
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatUSDT = (balance: string | number) => {
    const num = typeof balance === 'string' ? parseFloat(balance) : balance;
    if (isNaN(num) || num === 0) return "0.00000";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    }).format(num);
  };

  const shortAddress = (address?: string) => {
    if (!address) return t("notConnected");
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    if (walletAddress) {
      try {
        await navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = walletAddress;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (fallbackErr) {
          console.error('Failed to copy:', fallbackErr);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  // Calculate total net worth
  const shoppingBalance = parseFloat(referralInfo?.accumulatedPurchases || '0');
  const affiliateBalance = parseFloat(referralInfo?.bonusCommission || '0');
  const usdtBalanceNum = parseFloat(usdtBalance || '0');
  const totalNetWorth = shoppingBalance + affiliateBalance + usdtBalanceNum;

  // Assets list
  const assets: Asset[] = [
    {
      symbol: "GRC",
      name: "USDT",
      balance: affiliateBalance,
      usdValue: affiliateBalance,
      color: "bg-[#13ec5b]",
    },
    {
      symbol: "USDT",
      name: t("tether"),
      balance: usdtBalanceNum,
      usdValue: usdtBalanceNum,
      color: "bg-[#26A17B]",
    },
  ];

  // Recent transactions - combine commissions and orders
  const allTransactions: Transaction[] = [
    // Commissions
    ...(referralInfo?.recentActivity?.map((activity: any) => {
      // Normalize activity type to handle both uppercase and lowercase
      const activityType = String(activity.type || '').toUpperCase();
      
      // Determine commission type label
      const commissionTitle = activityType === 'DIRECT' 
        ? t("directCommission")
        : activityType === 'GROUP' 
        ? t("groupCommission")
        : t("managementCommission");
      
      return {
        id: activity.id,
        type: 'commission' as const,
        title: commissionTitle,
        amount: parseFloat(activity.amount),
        status: activity.status === 'PENDING' ? t("pending") : t("completed"),
        date: new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        createdAt: activity.createdAt, // Keep original for sorting
        icon: 'call_received',
        iconColor: 'text-[#13ec5b]',
      };
    }) || []),
    // Orders
    ...(orders.map((order: any) => ({
      id: order.id,
      type: 'order' as const,
      title: t("orderPurchase"),
      amount: -order.totalAmount, // Negative for purchases
      status: order.status === 'delivered' ? t("completed") : t("pending"),
      date: new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      createdAt: order.createdAt, // Keep original for sorting
      icon: 'shopping_cart',
      iconColor: 'text-blue-600',
    })) || []),
  ];
  
  // Sort by createdAt descending and take top 5
  const transactions: Transaction[] = allTransactions
    .sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    })
    .slice(0, 5)
    .map(({ createdAt, ...rest }: any) => rest); // Remove createdAt before displaying

  if (loading) {
    return (
      <div className="flex flex-col bg-background-gray">
        <AppHeader titleKey="navWallets" />
        <main className="flex-1 pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500">{t("loading")}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background-gray min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-[0_1px_3px_rgba(37,99,235,0.05)]">
        <button 
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-blue-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("navWallets")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/10 border border-blue-600/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">SafePal</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-blue-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 px-4 bg-white">
        {/* Main Balance Card */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-md border border-gray-100">
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-xs font-medium text-primary-dark">{t("connectedToSafePal")}</span>
              </div>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {balanceVisible ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-gray-600">{t("totalNetWorth")}</p>
              <h2 className="text-4xl font-bold tracking-tight text-text-dark">
                {balanceVisible ? `$${formatUSDT(totalNetWorth)}` : '••••••'}
              </h2>
              <button
                onClick={copyAddress}
                type="button"
                className="flex items-center gap-2 mt-1 cursor-pointer group hover:opacity-80 transition-opacity"
              >
                <p className="text-sm font-mono text-gray-500 group-hover:text-primary-dark transition-colors">
                  {shortAddress(walletAddress)}
                </p>
                <span className={`material-symbols-outlined text-[16px] transition-colors ${
                  copied 
                    ? "text-primary-dark" 
                    : "text-gray-400 group-hover:text-primary-dark"
                }`}>
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Affiliate Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 rounded-xl bg-white p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-dark text-[20px]">shopping_cart</span>
              <p className="text-xs font-medium text-gray-600">{t("shopping")}</p>
            </div>
            <p className="text-xl font-bold text-text-dark">
              ${formatUSDT(shoppingBalance)}
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-white p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-500 text-[20px]">group_work</span>
              <p className="text-xs font-medium text-gray-600">{t("affiliate")}</p>
            </div>
            <p className="text-xl font-bold text-text-dark">
              ${formatUSDT(affiliateBalance)}
            </p>
          </div>
        </div>

        {/* Assets List */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold px-1 text-text-dark">{t("assets")}</h3>
          <div className="flex flex-col gap-3">
            {assets.map((asset, index) => (
              <div
                key={asset.symbol}
                className="flex items-center justify-between rounded-xl bg-white p-4 border border-gray-100 shadow-sm hover:border-gray-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`relative h-10 w-10 rounded-full ${asset.color} flex items-center justify-center text-white font-bold text-lg`}>
                    {asset.icon ? (
                      <span className="material-symbols-outlined text-[24px]">{asset.icon}</span>
                    ) : (
                      asset.symbol[0]
                    )}
                    {index === 0 && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-white border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-text-dark">{asset.name}</p>
                    <p className="text-xs text-gray-500">{asset.symbol}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-base font-bold text-text-dark">
                    {balanceVisible 
                      ? formatUSDT(asset.balance)
                      : '••••'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {balanceVisible ? `≈ $${formatUSDT(asset.usdValue)}` : '••••'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="flex flex-col gap-4 pb-20">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-text-dark">{t("recentActivityTitle")}</h3>
            <button 
              onClick={() => router.push('/home/wallets/activity')}
              className="text-sm font-medium text-primary-dark hover:text-primary"
            >
              {t("seeAll")}
            </button>
          </div>
          <div className="flex flex-col divide-y divide-gray-200 rounded-xl bg-white border border-gray-100 shadow-sm">
            {transactions.length > 0 ? (
              transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    index === 0 ? 'rounded-t-xl' : index === transactions.length - 1 ? 'rounded-b-xl' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 ${tx.iconColor}`}>
                      <span className="material-symbols-outlined">{tx.icon}</span>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-text-dark">{tx.title}</p>
                      <p className="text-xs text-gray-500">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.type === 'commission' || tx.type === 'deposit' ? 'text-primary-dark' : 'text-text-dark'}`}>
                      {tx.type === 'commission' || tx.type === 'deposit' ? '+' : '-'} ${formatUSDT(Math.abs(tx.amount))}
                    </p>
                    <p className="text-xs text-gray-500">{tx.status}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center p-6">
                <p className="text-sm text-gray-500">{t("noRecentTransactions")}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
