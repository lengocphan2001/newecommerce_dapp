"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

interface Transaction {
  id: string;
  type: 'commission' | 'order' | 'deposit' | 'withdraw';
  title: string;
  amount: number;
  status: string;
  date: string;
  icon: string;
  iconColor: string;
  /** Heap reward is credited in full to withdraw wallet; do not apply commission wallet split display. */
  skipWalletSplitDisplay?: boolean;
}

export default function WalletsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [depositRequests, setDepositRequests] = useState<any[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  // Controlamos la visibilidad del modal de recarga para el monedero PV
  const [showPvDepositModal, setShowPvDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBankAccountModal, setShowBankAccountModal] = useState(false);
  const [depositForm, setDepositForm] = useState({ amountVnd: "", proofImageUrl: "", transferNote: "", method: "BANKING" as "BANKING" | "USDT", requestedUsdt: "", txHash: "", senderAddress: "" });
  // Estados específicos para el formulario de recarga de PV (Explicación en español: guardamos requestedUsdt directamente para mayor claridad e intuición del usuario)
  const [pvDepositForm, setPvDepositForm] = useState({ requestedUsdt: "", senderAddress: "", txHash: "" });
  const [pvDepositSubmitting, setPvDepositSubmitting] = useState(false);
  const [pvDepositError, setPvDepositError] = useState("");
  const [withdrawForm, setWithdrawForm] = useState({
    amountVnd: "",
    method: "BANKING",
    bankAccountId: "",
    note: "",
  });
  const [bankAccountForm, setBankAccountForm] = useState({
    id: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    bankCode: "",
    qrImageUrl: "",
    isDefault: false,
  });
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [bankAccountSubmitting, setBankAccountSubmitting] = useState(false);
  const [bankQrUploading, setBankQrUploading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [depositError, setDepositError] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [bankAccountError, setBankAccountError] = useState("");
  const [bankingConfig, setBankingConfig] = useState<{
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    bankId?: string;
    qrImageUrl?: string;
    isEnabled?: boolean;
    usdtPriceVnd?: number | null;
    usdtWithdrawPriceVnd?: number | null;
    usdtEnabled?: boolean;
    usdtWalletAddress?: string;
    usdtNetwork?: string;
    usdtQrImageUrl?: string;
  } | null>(null);
  const [copiedDeposit, setCopiedDeposit] = useState<string | null>(null);

  const walletBalance = parseFloat(referralInfo?.walletBalance || "0") || 0;
  // Obtenemos el saldo acumulado en PV de la cuenta del usuario
  const pvWalletBalance = parseFloat(referralInfo?.pvWalletBalance || "0") || 0;
  const withdrawWalletBalance = parseFloat(referralInfo?.withdrawWalletBalance || "0") || 0;
  const reconsumptionWalletBalance = parseFloat(referralInfo?.reconsumptionWalletBalance || "0") || 0;
  const walletAddress = referralInfo?.walletAddress || "";

  const parseVndAmount = (value: string): number => {
    const digitsOnly = (value || "").replace(/[^\d]/g, "");
    if (!digitsOnly) return 0;
    return parseInt(digitsOnly, 10);
  };

  const formatVndInput = (value: string): string => {
    const amount = parseVndAmount(value);
    if (!amount) return "";
    return amount.toLocaleString("vi-VN");
  };

  /** Số tiền rút ví — USDT (khớp withdrawWalletBalance & API). */
  const parseUsdtAmount = (value: string): number => {
    const cleaned = (value || "").replace(/,/g, "").trim();
    if (!cleaned) return 0;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  const sanitizeUsdtInput = (raw: string): string => {
    let v = raw.replace(/,/g, "").replace(/[^\d.]/g, "");
    const dot = v.indexOf(".");
    if (dot !== -1) {
      const intp = v.slice(0, dot + 1);
      let dec = v.slice(dot + 1).replace(/\./g, "");
      dec = dec.slice(0, 8);
      v = intp + dec;
    }
    return v;
  };

  const usdtToMaxInputString = (n: number): string => {
    if (!Number.isFinite(n) || n <= 0) return "";
    const s = n.toFixed(8).replace(/\.?0+$/, "");
    return s || "0";
  };

  useEffect(() => {
    fetchWalletData();
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!showDepositModal && !showWithdrawModal) return;
    api.getBankingConfig().then((c) => setBankingConfig(c)).catch(() => setBankingConfig(null));
  }, [showDepositModal, showWithdrawModal]);

  const copyDeposit = async (text: string, field: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDeposit(field);
      setTimeout(() => setCopiedDeposit(null), 2000);
    } catch { /* ignore */ }
  };

  const getDepositVietQrUrl = (): string | null => {
    const bankId = bankingConfig?.bankId?.trim();
    const accountNumber = bankingConfig?.accountNumber?.trim().replace(/\s/g, "");
    const accountName = (bankingConfig?.accountName || "").trim();
    if (!bankId || !accountNumber) return null;
    const template = "compact2";
    const base = `https://img.vietqr.io/image/${bankId}-${accountNumber}-${template}.png`;
    const params = new URLSearchParams();
    const vndAmount = parseVndAmount(depositForm.amountVnd);
    if (vndAmount > 0) params.set("amount", String(vndAmount));
    const addInfo = `${referralInfo?.username || "user"} nap tien vao vi`.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 25);
    params.set("addInfo", addInfo || "nap tien vao vi");
    if (accountName) params.set("accountName", accountName);
    return `${base}?${params.toString()}`;
  };
  const depositVietQrUrl = getDepositVietQrUrl();
  const depositTransferContent = `${referralInfo?.username || "user"} nap tien vao vi`.replace(/\s+/g, " ").trim();

  const fetchOrders = async () => {
    try {
      const data = await api.getOrders(undefined, { limit: 30 });
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

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      try {
        const [info, requests, withdraws, banks, bankCfg] = await Promise.all([
          api.getReferralInfo(),
          api.getMyDepositRequests().catch(() => []),
          api.getMyWithdrawRequests().catch(() => []),
          api.getMyBankAccounts().catch(() => []),
          api.getBankingConfig().catch(() => null),
        ]);
        setReferralInfo(info);
        setDepositRequests(Array.isArray(requests) ? requests : []);
        setWithdrawRequests(Array.isArray(withdraws) ? withdraws : []);
        setBankAccounts(Array.isArray(banks) ? banks : []);
        if (bankCfg) setBankingConfig(bankCfg);
      } catch (err: any) {
        if (handleAuthError(err, router)) return;
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDepositProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofUploading(true);
    setDepositError("");
    try {
      const { url } = await api.uploadDepositProof(file);
      setDepositForm((f) => ({ ...f, proofImageUrl: url }));
    } catch (err: any) {
      setDepositError(err?.message || "Tải ảnh lên thất bại");
    } finally {
      setProofUploading(false);
    }
  };

  const handleSubmitDeposit = async () => {
    setDepositError("");

    let payload: any = {
      method: depositForm.method,
      proofImageUrl: depositForm.proofImageUrl || undefined,
      transferNote: depositForm.transferNote || undefined,
    };

    if (depositForm.method === "BANKING") {
      const amountVnd = parseVndAmount(depositForm.amountVnd);
      if (!depositForm.amountVnd || isNaN(amountVnd) || amountVnd < 1000) {
        setDepositError("Nhập số tiền đã chuyển (VND) tối thiểu 1.000");
        return;
      }
      payload.amountVnd = amountVnd;
    } else {
      const requestedUsdt = parseUsdtAmount(depositForm.requestedUsdt);
      if (!depositForm.requestedUsdt || isNaN(requestedUsdt) || requestedUsdt <= 0) {
        setDepositError("Nhập số lượng USDT hợp lệ");
        return;
      }
      if (!depositForm.senderAddress || !depositForm.senderAddress.trim()) {
        setDepositError("Vui lòng cung cấp địa chỉ ví gửi tiền (senderAddress)");
        return;
      }
      payload.requestedUsdt = requestedUsdt;
      payload.senderAddress = depositForm.senderAddress.trim();
      payload.txHash = depositForm.txHash || undefined;
    }

    setDepositSubmitting(true);
    try {
      await api.createDepositRequest(payload);
      setShowDepositModal(false);
      setDepositForm({ amountVnd: "", proofImageUrl: "", transferNote: "", method: "BANKING", requestedUsdt: "", txHash: "", senderAddress: "" });
      const requests = await api.getMyDepositRequests();
      setDepositRequests(Array.isArray(requests) ? requests : []);
    } catch (err: any) {
      setDepositError(err?.message || "Gửi yêu cầu thất bại");
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Manejador para enviar la solicitud de recarga del monedero PV mediante transferencia de USDT
  const handleSubmitPvDeposit = async () => {
    setPvDepositError("");
    // Explicación en español: Leemos el monto en USDT directamente ingresado por el usuario
    const requestedUsdt = parseFloat(pvDepositForm.requestedUsdt || "0") || 0;
    if (requestedUsdt <= 0) {
      setPvDepositError("Vui lòng nhập số lượng USDT hợp lệ");
      return;
    }
    if (!pvDepositForm.senderAddress || !pvDepositForm.senderAddress.trim()) {
      setPvDepositError("Vui lòng cung cấp địa chỉ ví gửi tiền (senderAddress)");
      return;
    }

    let payload = {
      method: "USDT" as const,
      requestedUsdt,
      senderAddress: pvDepositForm.senderAddress.trim(),
      txHash: pvDepositForm.txHash.trim() || undefined,
    };

    setPvDepositSubmitting(true);
    try {
      await api.createDepositRequest(payload);
      setShowPvDepositModal(false);
      setPvDepositForm({ requestedUsdt: "", senderAddress: "", txHash: "" });
      const requests = await api.getMyDepositRequests();
      setDepositRequests(Array.isArray(requests) ? requests : []);
    } catch (err: any) {
      setPvDepositError(err?.message || "Gửi yêu cầu thất bại");
    } finally {
      setPvDepositSubmitting(false);
    }
  };

  const handleOpenWithdraw = () => {
    setWithdrawError("");
    setWithdrawForm({
      amountVnd: "",
      method: "BANKING",
      bankAccountId: "",
      note: "",
    });
    setShowWithdrawModal(true);
  };

  const handleSubmitWithdraw = async () => {
    setWithdrawError("");
    const amountVnd = parseVndAmount(withdrawForm.amountVnd || "");
    const rate = usdtWithdrawRateVnd > 0 ? usdtWithdrawRateVnd : 24000;
    const amount = amountVnd / rate;

    if (!amount || amount < 30) {
      setWithdrawError(`Số tiền rút tối thiểu là 30 PV (~${(30 * rate).toLocaleString("vi-VN")} ₫)`);
      return;
    }
    if (amount > withdrawWalletBalance + 1e-10) {
      setWithdrawError("Số dư ví rút không đủ");
      return;
    }
    if (!withdrawForm.bankAccountId) {
      setWithdrawError("Vui lòng chọn tài khoản ngân hàng nhận tiền");
      return;
    }

    setWithdrawSubmitting(true);
    try {
      await api.createWithdrawRequest({
        amount,
        method: "BANKING",
        bankAccountId: withdrawForm.bankAccountId,
        note: withdrawForm.note || undefined,
      });
      setShowWithdrawModal(false);
      await fetchWalletData();
    } catch (err: any) {
      const msg = err?.message || "Gửi yêu cầu rút tiền thất bại";
      if (String(msg).includes("MISSING_USDT_WALLET")) {
        setShowWithdrawModal(false);
        router.push("/home/profile/edit");
        return;
      }
      setWithdrawError(msg);
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const openCreateBankAccount = () => {
    setBankAccountError("");
    setBankAccountForm({
      id: "",
      bankName: "",
      accountNumber: "",
      accountName: "",
      bankCode: "",
      qrImageUrl: "",
      isDefault: bankAccounts.length === 0,
    });
    setShowBankAccountModal(true);
  };

  const openEditBankAccount = (item: any) => {
    setBankAccountError("");
    setBankAccountForm({
      id: item.id,
      bankName: item.bankName || "",
      accountNumber: item.accountNumber || "",
      accountName: item.accountName || "",
      bankCode: item.bankCode || "",
      qrImageUrl: item.qrImageUrl || "",
      isDefault: Boolean(item.isDefault),
    });
    setShowBankAccountModal(true);
  };

  const handleSaveBankAccount = async () => {
    setBankAccountError("");
    if (!bankAccountForm.bankName || !bankAccountForm.accountNumber || !bankAccountForm.accountName) {
      setBankAccountError("Vui lòng nhập đầy đủ tên ngân hàng, số tài khoản, chủ tài khoản");
      return;
    }
    setBankAccountSubmitting(true);
    try {
      const payload = {
        bankName: bankAccountForm.bankName,
        accountNumber: bankAccountForm.accountNumber,
        accountName: bankAccountForm.accountName,
        bankCode: bankAccountForm.bankCode || undefined,
        qrImageUrl: bankAccountForm.qrImageUrl,
        isDefault: bankAccountForm.isDefault,
      };
      if (bankAccountForm.id) {
        await api.updateBankAccount(bankAccountForm.id, payload);
      } else {
        await api.createBankAccount(payload);
      }
      setShowBankAccountModal(false);
      await fetchWalletData();
    } catch (err: any) {
      setBankAccountError(err?.message || "Lưu tài khoản ngân hàng thất bại");
    } finally {
      setBankAccountSubmitting(false);
    }
  };

  const handleBankQrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBankQrUploading(true);
    setBankAccountError("");
    try {
      const { url } = await api.uploadDepositProof(file);
      setBankAccountForm((f) => ({ ...f, qrImageUrl: url }));
    } catch (err: any) {
      setBankAccountError(err?.message || "Tải QR thất bại");
    } finally {
      setBankQrUploading(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm("Xóa tài khoản ngân hàng này?")) return;
    try {
      await api.deleteBankAccount(id);
      await fetchWalletData();
    } catch (err: any) {
      if (handleAuthError(err, router)) return;
      alert(err?.message || "Xóa tài khoản thất bại");
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
    if (isNaN(num) || num === 0) return "0.00";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  };

  /** Tỷ giá chỉ cho modal rút ví — tách với tỷ giá nạp/checkout (`usdtPriceVnd`). */
  const usdtWithdrawRateVnd =
    bankingConfig?.usdtWithdrawPriceVnd != null &&
      Number(bankingConfig.usdtWithdrawPriceVnd) > 0
      ? Number(bankingConfig.usdtWithdrawPriceVnd)
      : 0;
  const activeWithdrawRate = usdtWithdrawRateVnd > 0 ? usdtWithdrawRateVnd : 24000;
  const withdrawAmountVnd = parseVndAmount(withdrawForm.amountVnd || "");
  const withdrawEquivalentUsdt = withdrawAmountVnd / activeWithdrawRate;

  const balanceApproxVnd = Math.round(withdrawWalletBalance * activeWithdrawRate);
  const reconsumptionApproxVnd = Math.round(reconsumptionWalletBalance * activeWithdrawRate);

  const usdtDepositRateVnd =
    bankingConfig?.usdtPriceVnd != null && Number(bankingConfig.usdtPriceVnd) > 0
      ? Number(bankingConfig.usdtPriceVnd)
      : 25000;

  const walletApproxVnd =
    usdtDepositRateVnd > 0 && walletBalance > 0
      ? Math.round(walletBalance * usdtDepositRateVnd)
      : Math.round(walletBalance * 25000); // fallback


  // Preserve the following if needed elsewhere, otherwise we can just compute it. 
  // Looks like depositPercent / withdrawPercent are used later for feePercent, so keep them.
  const depositPercent = referralInfo?.commissionDepositWalletPercent ?? 12;
  const withdrawPercent = referralInfo?.commissionWithdrawWalletPercent ?? 80;
  const feePercent = referralInfo?.payoutFeePercent ?? Math.max(0, 100 - (depositPercent + withdrawPercent));

  // Helper function to safely format date
  const formatDateSafe = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Helper function to safely create Date for sorting
  const createDateSafe = (dateString: string | null | undefined): string => {
    if (!dateString) return new Date(0).toISOString();
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return new Date(0).toISOString();
      return dateString;
    } catch {
      return new Date(0).toISOString();
    }
  };

  // Recent transactions - combine commissions and orders
  const allTransactions: Transaction[] = [
    // Commissions
    ...(referralInfo?.recentActivity
      ?.filter((activity: any) => {
        const activityType = String(activity?.type || "").toUpperCase();
        const notes = String(activity?.notes || "");
        return (
          activityType === "DIRECT" ||
          activityType === "INDIRECT" ||
          activityType === "HEAP_REWARD" ||
          (activityType === "PRODUCT" && notes.startsWith("Product direct"))
        );
      })
      .map((activity: any) => {
        // Normalize activity type to handle both uppercase and lowercase
        const activityType = String(activity.type || '').toUpperCase();

        // Determine commission type label
        const commissionTitle = activityType === 'DIRECT'
          ? t("directCommission")
          : activityType === 'INDIRECT'
            ? t("indirectCommission")
          : activityType === 'HEAP_REWARD'
            ? t("heapRewardCommission")
            : activityType === 'GROUP'
              ? t("groupCommission")
              : t("managementCommission");

        return {
          id: activity.id,
          type: 'commission' as const,
          title: commissionTitle,
          amount: parseFloat(activity.amount),
          status: activity.status === 'PENDING' ? t("pending") : t("completed"),
          date: formatDateSafe(activity.createdAt),
          createdAt: createDateSafe(activity.createdAt), // Keep original for sorting
          icon: 'call_received',
          iconColor: 'text-[#13ec5b]',
          skipWalletSplitDisplay: activityType === 'HEAP_REWARD',
        };
      }) || []),
    // Orders
    ...(orders.map((order: any) => ({
      id: order.id,
      type: 'order' as const,
      title: t("orderPurchase"),
      amount: -order.totalAmount, // Negative for purchases
      status: order.status === 'delivered' ? t("completed") : t("pending"),
      date: formatDateSafe(order.createdAt),
      createdAt: createDateSafe(order.createdAt), // Keep original for sorting
      icon: 'shopping_cart',
      iconColor: 'text-primary-dark',
    })) || []),
  ];

  // Sort by createdAt descending and take top 5
  const transactions: Transaction[] = allTransactions
    .filter((tx: any) => tx.date) // Filter out transactions with invalid dates
    .sort((a: any, b: any) => {
      try {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        if (isNaN(dateA) || isNaN(dateB)) return 0;
        return dateB - dateA;
      } catch {
        return 0;
      }
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
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_3px_rgba(16,185,129,0.15)]">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-emerald-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("navWallets")}</h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-bold text-primary-dark uppercase tracking-wider">Shoplife</span>
          </div>
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-emerald-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 px-4 bg-white mt-4">
        {/* Thông tin cá nhân */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-md border border-violet-200">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
          <div className="relative z-10 flex items-center gap-3">
            {referralInfo?.avatar ? (
              <img src={referralInfo.avatar} alt="" className="h-12 w-12 rounded-full object-cover border border-violet-100 shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-violet-600 text-2xl">person</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-text-dark truncate leading-tight">
                {referralInfo?.fullName?.trim() || referralInfo?.username || "—"}
              </h2>
              <p className="text-xs text-gray-500 truncate">@{referralInfo?.username}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {referralInfo?.packageType && referralInfo.packageType !== "NONE" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    {referralInfo.packageType}
                  </span>
                )}
                {referralInfo?.createdAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(referralInfo.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/home/profile/edit")}
              className="shrink-0 text-xs font-semibold text-primary-dark hover:text-primary"
            >
              Chỉnh sửa
            </button>
          </div>
        </div>

      

        {/* Ví rút tiền */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-md border border-rose-200">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-orange-400" />
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Ví thưởng</p>
              <p className="text-2xl font-bold text-text-dark mt-1">
                {balanceVisible ? `${balanceApproxVnd.toLocaleString("vi-VN")} ₫` : "••••••"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenWithdraw}
              className="rounded-xl bg-rose-500 text-white font-semibold px-4 py-2.5 flex items-center gap-2 hover:bg-rose-600"
            >
              <span className="material-symbols-outlined text-lg">payments</span>
              Rút tiền
            </button>
          </div>
          {withdrawRequests.length > 0 && (
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Yêu cầu rút tiền gần đây</p>
              <div className="space-y-2">
                {withdrawRequests.slice(0, 5).map((r: any) => {
                  // Mostrar la cantidad en VND congelada de la base de datos o calcularla dinámicamente como respaldo para registros antiguos
                  const amountVnd = r.amountVnd != null
                    ? Number(r.amountVnd)
                    : Math.round(Number(r.amount || 0) * activeWithdrawRate);
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                      <span className="font-mono">{`${amountVnd.toLocaleString("vi-VN")} VND`}</span>
                      <span className="text-xs text-gray-600">{r.method}</span>
                      <span className={`font-medium ${r.status === "PENDING" ? "text-amber-600" : r.status === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                        {r.status === "PENDING" ? "Chờ duyệt" : r.status === "APPROVED" ? "Đã duyệt" : "Từ chối"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600">Tài khoản ngân hàng nhận tiền</p>
              <button
                type="button"
                onClick={openCreateBankAccount}
                className="text-primary-dark text-xs font-semibold"
              >
                + Thêm
              </button>
            </div>
            {bankAccounts.length === 0 ? (
              <p className="text-xs text-gray-500">Bạn chưa có tài khoản ngân hàng nào.</p>
            ) : (
              <div className="space-y-2">
                {bankAccounts.map((b: any) => (
                  <div key={b.id} className="rounded-lg border border-gray-100 p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {b.bankName} {b.isDefault ? "(Mặc định)" : ""}
                        </p>
                        <p className="text-xs text-slate-500">{b.accountName} - {b.accountNumber}</p>
                        {b.qrImageUrl && (
                          <img
                            src={b.qrImageUrl}
                            alt="Bank QR"
                            className="mt-2 w-16 h-16 object-contain rounded border border-slate-200 bg-white"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEditBankAccount(b)} className="text-xs text-primary-dark">Sửa</button>
                        <button type="button" onClick={() => handleDeleteBankAccount(b.id)} className="text-xs text-red-600">Xóa</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ví nạp tiền (banking) */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-md border border-cyan-200">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Ví tiêu dùng</p>
              <p className="text-2xl font-bold text-text-dark mt-1">
                {balanceVisible ? `${walletApproxVnd.toLocaleString("vi-VN")} ₫` : "••••••"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowDepositModal(true); setDepositError(""); setDepositForm({ amountVnd: "", proofImageUrl: "", transferNote: "", method: "BANKING", requestedUsdt: "", txHash: "", senderAddress: "" }); }}
              className="rounded-xl bg-cyan-500 text-white font-semibold px-4 py-2.5 flex items-center gap-2 hover:bg-cyan-600"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nạp tiền
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Chuyển khoản theo hướng dẫn thanh toán, gửi yêu cầu và đợi admin duyệt để cộng tiền vào ví.</p>
          {depositRequests.filter(r => r.method !== "USDT").length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Yêu cầu nạp tiền gần đây</p>
              <div className="space-y-2">
                {depositRequests.filter(r => r.method !== "USDT").slice(0, 5).map((r: any) => {
                  const amountStr = `${Number(r.amountVnd || 0).toLocaleString("vi-VN")} VND`;
                  const approvedText = `Đã cộng ${Number(r.amountVnd || 0).toLocaleString("vi-VN")} VND`;

                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                      <span className="font-mono">{amountStr}</span>
                      <span className={`font-medium ${r.status === "PENDING" ? "text-amber-600" : r.status === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                        {r.status === "PENDING" ? "Chờ duyệt" : r.status === "APPROVED" ? approvedText : "Từ chối"}
                      </span>
                      <span className="text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Ví nạp PV (USDT) */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-md border border-indigo-200">
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Ví nạp PV</p>
              <p className="text-2xl font-bold text-text-dark mt-1">
                {balanceVisible ? `${formatUSDT(pvWalletBalance)} PV` : "••••••"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tỷ giá nạp: 1 PV = 1.08 USDT
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPvDepositModal(true);
                setPvDepositError("");
                setPvDepositForm({
                  requestedUsdt: "",
                  senderAddress: "",
                  txHash: "",
                });
              }}
              className="rounded-xl bg-indigo-600 text-white font-semibold px-4 py-2.5 flex items-center gap-2 hover:bg-indigo-700"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Nạp PV
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">Nạp USDT để quy đổi sang PV dùng thanh toán các đơn hàng sản phẩm thông dụng.</p>
          {depositRequests.filter(r => r.method === "USDT").length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Yêu cầu nạp PV gần đây</p>
              <div className="space-y-2">
                {depositRequests.filter(r => r.method === "USDT").slice(0, 5).map((r: any) => {
                  const amountStr = `${Number(r.requestedUsdt || 0).toLocaleString()} USDT`;
                  const approvedText = `Đã cộng ${formatUSDT(r.amount || 0)} PV`;
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                      <span className="font-mono">{amountStr}</span>
                      <span className={`font-medium ${r.status === "PENDING" ? "text-amber-600" : r.status === "APPROVED" ? "text-green-600" : "text-red-600"}`}>
                        {r.status === "PENDING" ? "Chờ duyệt" : r.status === "APPROVED" ? approvedText : "Từ chối"}
                      </span>
                      <span className="text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Nạp tiền (VND Banking) */}
        {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto py-8" onClick={() => !depositSubmitting && setShowDepositModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-text-dark mb-4">Nạp tiền vào ví tiêu dùng</h3>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">1. Số tiền muốn nạp (VND) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={depositForm.amountVnd}
                  onChange={(e) =>
                    setDepositForm((f) => ({ ...f, amountVnd: formatVndInput(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-lg font-medium"
                  placeholder="VD: 500.000"
                />
                <p className="text-xs text-slate-500 mt-1">Sau khi nhập, mã QR sẽ hiển thị bên dưới để bạn chuyển khoản đúng số tiền.</p>
              </div>

              {bankingConfig?.isEnabled && (bankingConfig.accountNumber || bankingConfig.bankName) ? (
                <>
                  <p className="text-sm font-semibold text-slate-700 mb-2">2. Chuyển khoản đến tài khoản sau:</p>
                  
                  {depositVietQrUrl && parseVndAmount(depositForm.amountVnd) >= 1000 ? (
                    <div className="flex flex-col items-center mb-4">
                      <p className="text-xs text-slate-600 mb-2">Quét mã QR để chuyển khoản</p>
                      <img src={depositVietQrUrl} alt="VietQR" className="w-56 h-56 object-contain rounded-lg border border-slate-200 bg-white" />
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3 mb-4">Chưa có cấu hình ngân hàng.</p>
              )}

              <div className="border-t border-slate-200 pt-4 mt-4">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  3. Sau khi chuyển khoản xong, bấm Gửi yêu cầu (có thể tải lên ảnh biên lai).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ảnh chụp màn hình (tùy chọn)</label>
                  <input type="file" accept="image/*" onChange={handleDepositProofChange} className="hidden" id="deposit-proof" />
                  <label htmlFor="deposit-proof" className="flex items-center justify-center py-2 px-4 rounded-xl border border-dashed border-gray-300 cursor-pointer text-sm text-primary-dark w-full bg-slate-50/50">
                    {proofUploading ? "Đang tải lên..." : depositForm.proofImageUrl ? "✓ Đã tải xong (Bấm để tải lại)" : "Chọn ảnh biên lai giao dịch"}
                  </label>
                </div>
                {depositError && <p className="text-sm text-red-600">{depositError}</p>}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => !depositSubmitting && setShowDepositModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium">Hủy</button>
                <button type="button" onClick={handleSubmitDeposit} disabled={depositSubmitting} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium disabled:opacity-70">
                  {depositSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Nạp PV (USDT Crypto) */}
        {showPvDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto py-8" onClick={() => !pvDepositSubmitting && setShowPvDepositModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-text-dark mb-4">Nạp PV bằng USDT</h3>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">1. Số lượng USDT muốn nạp *</label>
                <input
                  type="text"
                  value={pvDepositForm.requestedUsdt}
                  onChange={(e) => {
                    let val = sanitizeUsdtInput(e.target.value);
                    setPvDepositForm((f) => ({ ...f, requestedUsdt: val }));
                  }}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-lg font-medium"
                  placeholder="VD: 100"
                />
                {pvDepositForm.requestedUsdt && (
                  <p className="text-xs text-indigo-600 mt-1 font-semibold">
                    Số PV nhận được (quy đổi): {formatUSDT(parseFloat(pvDepositForm.requestedUsdt || "0") / 1.08)} PV
                  </p>
                )}
              </div>

              {bankingConfig?.usdtWalletAddress ? (
                <>
                  <p className="text-sm font-semibold text-slate-700 mb-2">2. Chuyển USDT đến địa chỉ sau:</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2 mb-3">
                    {bankingConfig.usdtNetwork && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500">Mạng lưới (Network)</span>
                        <span className="font-semibold text-slate-900">{bankingConfig.usdtNetwork}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Địa chỉ ví</span>
                      <button type="button" onClick={() => copyDeposit(bankingConfig.usdtWalletAddress!, "usdtWallet")} className="shrink-0 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium">
                        {copiedDeposit === "usdtWallet" ? "Đã copy" : "Copy"}
                      </button>
                    </div>
                    <p className="font-mono font-semibold text-slate-900 text-sm break-all">{bankingConfig.usdtWalletAddress}</p>
                  </div>
                  {bankingConfig.usdtQrImageUrl && (
                    <div className="flex flex-col items-center mb-4">
                      <p className="text-xs text-slate-600 mb-2">Quét mã QR địa chỉ ví</p>
                      <img src={bankingConfig.usdtQrImageUrl} alt="USDT QR" className="w-56 h-56 object-contain rounded-lg border border-slate-200 bg-white" />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg p-3 mb-4">Admin chưa cấu hình địa chỉ ví USDT nhận PV.</p>
              )}

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">3. Địa chỉ ví gửi tiền (USDT của bạn) *</label>
                <input
                  type="text"
                  value={pvDepositForm.senderAddress}
                  onChange={(e) => setPvDepositForm((f) => ({ ...f, senderAddress: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  placeholder="0x..."
                />
                <p className="text-[11px] text-slate-500 mt-1">Hệ thống sẽ đối soát tự động giao dịch từ địa chỉ ví này để cộng PV.</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">4. Mã giao dịch (TxHash) hoặc link Tx (Tùy chọn)</label>
                <input
                  type="text"
                  value={pvDepositForm.txHash}
                  onChange={(e) => setPvDepositForm((f) => ({ ...f, txHash: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm"
                  placeholder="Nhập mã giao dịch tại đây..."
                />
              </div>

              <div className="border-t border-slate-200 pt-4 mt-4">
                <p className="text-xs text-gray-500 mb-3">
                  Sau khi chuyển khoản USDT xong, bấm Gửi yêu cầu (hệ thống sẽ tự động duyệt khi nhận được tiền).
                </p>
              </div>

              {pvDepositError && <p className="text-sm text-red-600 mb-4">{pvDepositError}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => !pvDepositSubmitting && setShowPvDepositModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium">Hủy</button>
                <button type="button" onClick={handleSubmitPvDeposit} disabled={pvDepositSubmitting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-70">
                  {pvDepositSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Rút tiền */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto py-8" onClick={() => !withdrawSubmitting && setShowWithdrawModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-text-dark mb-4">Rút tiền từ ví rút</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền rút (VND)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={withdrawForm.amountVnd}
                      onChange={(e) =>
                        setWithdrawForm((f) => ({
                          ...f,
                          amountVnd: formatVndInput(e.target.value),
                        }))
                      }
                      className="flex-1 min-w-0 rounded-xl border border-gray-300 px-4 py-2.5 font-mono"
                      placeholder="VD: 500.000"
                    />
                    <button
                      type="button"
                      disabled={withdrawSubmitting || withdrawWalletBalance <= 0}
                      onClick={() =>
                        setWithdrawForm((f) => ({
                          ...f,
                          amountVnd: balanceApproxVnd.toLocaleString("vi-VN"),
                        }))
                      }
                      className="shrink-0 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary-dark disabled:opacity-50"
                    >
                      Max
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Số dư khả dụng:{" "}
                    <span className="font-mono text-gray-700">{balanceApproxVnd.toLocaleString("vi-VN")} ₫</span>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chọn tài khoản ngân hàng</label>
                  <select
                    value={withdrawForm.bankAccountId}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, bankAccountId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5"
                  >
                    <option value="">-- Chọn tài khoản --</option>
                    {bankAccounts.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} - {b.accountNumber} ({b.accountName})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú (tùy chọn)</label>
                  <textarea
                    value={withdrawForm.note}
                    onChange={(e) => setWithdrawForm((f) => ({ ...f, note: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 min-h-[72px]"
                    placeholder="Ghi chú thêm cho yêu cầu rút tiền"
                  />
                </div>
                {withdrawError && <p className="text-sm text-red-600">{withdrawError}</p>}
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => !withdrawSubmitting && setShowWithdrawModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium">Hủy</button>
                <button type="button" onClick={handleSubmitWithdraw} disabled={withdrawSubmitting} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium disabled:opacity-70">
                  {withdrawSubmitting ? "Đang gửi..." : "Gửi yêu cầu rút"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Thêm/Sửa tài khoản ngân hàng */}
        {showBankAccountModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 overflow-y-auto py-8" onClick={() => !bankAccountSubmitting && setShowBankAccountModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-text-dark mb-4">{bankAccountForm.id ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={bankAccountForm.bankName}
                  onChange={(e) => setBankAccountForm((f) => ({ ...f, bankName: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5"
                  placeholder="Tên ngân hàng"
                />
                <input
                  type="text"
                  value={bankAccountForm.accountNumber}
                  onChange={(e) => setBankAccountForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5"
                  placeholder="Số tài khoản"
                />
                <input
                  type="text"
                  value={bankAccountForm.accountName}
                  onChange={(e) => setBankAccountForm((f) => ({ ...f, accountName: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5"
                  placeholder="Chủ tài khoản"
                />
                <input
                  type="text"
                  value={bankAccountForm.bankCode}
                  onChange={(e) => setBankAccountForm((f) => ({ ...f, bankCode: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5"
                  placeholder="Mã ngân hàng (tùy chọn)"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QR thanh toán (tùy chọn)</label>
                  <input type="file" accept="image/*" onChange={handleBankQrChange} className="hidden" id="bank-qr-upload" />
                  <label htmlFor="bank-qr-upload" className="flex items-center justify-center py-2 px-4 rounded-xl border border-dashed border-gray-300 cursor-pointer text-sm text-primary-dark w-full bg-slate-50/50">
                    {bankQrUploading ? "Đang tải QR..." : bankAccountForm.qrImageUrl ? "✓ Đã tải QR (Bấm để đổi)" : "Chọn ảnh QR ngân hàng"}
                  </label>
                  {bankAccountForm.qrImageUrl && (
                    <img
                      src={bankAccountForm.qrImageUrl}
                      alt="QR preview"
                      className="mt-2 w-28 h-28 object-contain rounded border border-slate-200 bg-white"
                    />
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={bankAccountForm.isDefault}
                    onChange={(e) => setBankAccountForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  />
                  Đặt làm mặc định
                </label>
                {bankAccountError && <p className="text-sm text-red-600">{bankAccountError}</p>}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => !bankAccountSubmitting && setShowBankAccountModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium">Hủy</button>
                <button type="button" onClick={handleSaveBankAccount} disabled={bankAccountSubmitting} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium disabled:opacity-70">
                  {bankAccountSubmitting ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </div>
          </div>
        )}

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
                  className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer ${index === 0 ? 'rounded-t-xl' : index === transactions.length - 1 ? 'rounded-b-xl' : ''
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
                      {tx.type === 'commission' || tx.type === 'deposit'
                        ? `+${formatUSDT(
                            tx.skipWalletSplitDisplay
                              ? Math.abs(tx.amount)
                              : Math.abs(tx.amount) * (1 - feePercent / 100),
                          )} PV`
                        : `-${formatUSDT(Math.abs(tx.amount))} PV`}
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
