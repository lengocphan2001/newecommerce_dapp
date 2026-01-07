"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Contract, JsonRpcProvider, formatUnits, getAddress } from "ethers";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

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

  useEffect(() => {
    fetchWalletData();
  }, []);

  const loadUsdtBep20Balance = async (address: string) => {
    setIsLoadingUSDT(true);
    try {
      const provider = new JsonRpcProvider(BSC_RPC);
      const contract = new Contract(getAddress(USDT_BSC), ERC20_ABI, provider);
      const [decimals, balance] = await Promise.all([
        contract.decimals(),
        contract.balanceOf(getAddress(address)),
      ]);
      const formatted = formatUnits(balance as bigint, Number(decimals));
      setUsdtBalance(formatted);
      try {
        localStorage.setItem("usdtBep20Balance", formatted);
        localStorage.setItem("usdtBep20UpdatedAt", String(Date.now()));
      } catch {
        // ignore
      }
    } catch (error) {
      console.error("Error loading USDT balance:", error);
      // Try to use cached balance
      try {
        const cached = localStorage.getItem("usdtBep20Balance");
        if (cached) setUsdtBalance(cached);
      } catch {
        // ignore
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
      } catch (err) {
        // User might not be logged in or no referral info
      }
    } catch (error) {
      console.error("Failed to fetch wallet data:", error);
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
    if (!address) return "Not Connected";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      // You can add a toast notification here
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
      name: "Grocery Coin",
      balance: affiliateBalance,
      usdValue: affiliateBalance,
      color: "bg-[#13ec5b]",
    },
    {
      symbol: "USDT",
      name: "Tether",
      balance: usdtBalanceNum,
      usdValue: usdtBalanceNum,
      color: "bg-[#26A17B]",
    },
  ];

  // Recent transactions (mock data for now, can be fetched from API)
  const transactions: Transaction[] = [
    ...(referralInfo?.recentActivity?.slice(0, 3).map((activity: any) => ({
      id: activity.id,
      type: 'commission' as const,
      title: activity.type === 'DIRECT' ? 'Direct Commission' : activity.type === 'GROUP' ? 'Group Commission' : 'Management Commission',
      amount: parseFloat(activity.amount),
      status: activity.status === 'PENDING' ? 'Pending' : 'Completed',
      date: new Date(activity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      icon: 'call_received',
      iconColor: 'text-[#13ec5b]',
    })) || []),
  ];

  if (loading) {
    return (
      <div className="flex flex-col bg-[#f6f8f6] dark:bg-[#102216] min-h-screen">
        <AppHeader titleKey="navWallets" theme="dark" />
        <main className="flex-1 pb-28">
          <div className="px-4 py-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#f6f8f6] dark:bg-[#102216] min-h-screen overflow-x-hidden">
      {/* Top App Bar */}
      <AppHeader 
        titleKey="navWallets" 
        theme="dark" 
        showMenu={true} 
        showQRScanner={true}
        centerTitle={true}
        showActions={false}
      />

      <main className="flex-1 flex flex-col gap-6 p-4">
        {/* Main Balance Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#193322] to-[#23482f] p-6 shadow-xl border border-[#23482f]">
          {/* Decorative Glow */}
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#13ec5b]/20 blur-3xl"></div>
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-[#13ec5b] animate-pulse"></span>
                <span className="text-xs font-medium text-[#92c9a4]">Connected to SafePal</span>
              </div>
              <button
                onClick={() => setBalanceVisible(!balanceVisible)}
                className="text-[#92c9a4] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {balanceVisible ? 'visibility' : 'visibility_off'}
                </span>
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-[#92c9a4]">Total Net Worth</p>
              <h2 className="text-4xl font-bold tracking-tight text-white">
                {balanceVisible ? `$${formatUSDT(totalNetWorth)}` : '••••••'}
              </h2>
              <div
                onClick={copyAddress}
                className="flex items-center gap-2 mt-1 cursor-pointer group"
              >
                <p className="text-sm font-mono text-[#92c9a4] group-hover:text-[#13ec5b] transition-colors">
                  {shortAddress(walletAddress)}
                </p>
                <span className="material-symbols-outlined text-[16px] text-[#92c9a4] group-hover:text-[#13ec5b] transition-colors">
                  content_copy
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-4 gap-3">
          <button className="flex flex-col items-center gap-2 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#13ec5b] text-[#102216] shadow-lg shadow-[#13ec5b]/20 group-active:scale-95 transition-all">
              <span className="material-symbols-outlined">arrow_downward</span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-[#92c9a4]">Deposit</span>
          </button>
          <button className="flex flex-col items-center gap-2 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#23482f] text-white border border-[#193322] shadow-md group-active:scale-95 transition-all">
              <span className="material-symbols-outlined">send</span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-[#92c9a4]">Send</span>
          </button>
          <button className="flex flex-col items-center gap-2 group">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#23482f] text-white border border-[#193322] shadow-md group-active:scale-95 transition-all">
              <span className="material-symbols-outlined">swap_horiz</span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-[#92c9a4]">Swap</span>
          </button>
          <button
            onClick={() => router.push('/home/orders')}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#23482f] text-white border border-[#193322] shadow-md group-active:scale-95 transition-all">
              <span className="material-symbols-outlined">history</span>
            </div>
            <span className="text-xs font-medium text-gray-600 dark:text-[#92c9a4]">History</span>
          </button>
        </div>

        {/* Affiliate Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 rounded-xl bg-[#193322] p-4 border border-[#23482f]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#13ec5b] text-[20px]">shopping_cart</span>
              <p className="text-xs font-medium text-[#92c9a4]">Shopping</p>
            </div>
            <p className="text-xl font-bold text-white">
              ${formatUSDT(shoppingBalance)}
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-[#193322] p-4 border border-[#23482f]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-yellow-400 text-[20px]">group_work</span>
              <p className="text-xs font-medium text-[#92c9a4]">Affiliate</p>
            </div>
            <p className="text-xl font-bold text-white">
              ${formatUSDT(affiliateBalance)}
            </p>
          </div>
        </div>

        {/* Assets List */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-bold px-1 text-gray-900 dark:text-white">Assets</h3>
          <div className="flex flex-col gap-3">
            {assets.map((asset, index) => (
              <div
                key={asset.symbol}
                className="flex items-center justify-between rounded-xl bg-[#193322] p-4 border border-transparent hover:border-[#23482f] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`relative h-10 w-10 rounded-full ${asset.color} flex items-center justify-center text-white font-bold text-lg`}>
                    {asset.icon ? (
                      <span className="material-symbols-outlined text-[24px]">{asset.icon}</span>
                    ) : (
                      asset.symbol[0]
                    )}
                    {index === 0 && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-white border-2 border-[#193322]"></div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-base font-semibold text-white">{asset.name}</p>
                    <p className="text-xs text-[#92c9a4]">{asset.symbol}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-base font-bold text-white">
                    {balanceVisible 
                      ? formatUSDT(asset.balance)
                      : '••••'}
                  </p>
                  <p className="text-xs text-[#92c9a4]">
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity</h3>
            <button className="text-sm font-medium text-[#13ec5b] hover:text-[#0ea641]">
              See All
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[#23482f] rounded-xl bg-[#193322]">
            {transactions.length > 0 ? (
              transactions.map((tx, index) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-4 hover:bg-[#23482f]/50 transition-colors cursor-pointer ${
                    index === 0 ? 'rounded-t-xl' : index === transactions.length - 1 ? 'rounded-b-xl' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#23482f] ${tx.iconColor}`}>
                      <span className="material-symbols-outlined">{tx.icon}</span>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-white">{tx.title}</p>
                      <p className="text-xs text-[#92c9a4]">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.type === 'commission' || tx.type === 'deposit' ? 'text-[#13ec5b]' : 'text-white'}`}>
                      {tx.type === 'commission' || tx.type === 'deposit' ? '+' : '-'} ${formatUSDT(Math.abs(tx.amount))}
                    </p>
                    <p className="text-xs text-[#92c9a4]">{tx.status}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center p-6">
                <p className="text-sm text-[#92c9a4]">No recent transactions</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
