"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";
import TransactionProcessingModal, { ProcessingStep } from "@/app/components/TransactionProcessingModal";
import { api } from "@/app/services/api";
import { apiCache } from "@/app/services/apiCache";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useShoppingCart();
  const router = useRouter();
  const { t } = useI18n();
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [error, setError] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [checkoutUser, setCheckoutUser] = useState<{ fullName?: string; phone?: string; address?: string; username?: string } | null>(null);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [bankingConfig, setBankingConfig] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankId?: string;
    qrImageUrl?: string;
    isEnabled: boolean;
    usdtPriceVnd?: number | null;
    usdtEnabled?: boolean;
    usdtWalletAddress?: string;
    usdtNetwork?: string;
    usdtQrImageUrl?: string;
  } | null>(null);
  const [bankingOrderId, setBankingOrderId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<"bankName" | "accountNumber" | "accountName" | "content" | "walletAddress" | null>(null);
  const [usdtToVnd, setUsdtToVnd] = useState<number | null>(null);
  /** Tab thanh toán: 'deposit_wallet' = Ví nạp tiền, 'banking' = Chuyển khoản NH, 'usdt' = chuyển USDT */
  const [paymentTab, setPaymentTab] = useState<"deposit_wallet" | "banking" | "usdt">("deposit_wallet");
  /** Số dư ví nạp tiền (từ referral info hoặc wallet/balance) */
  const [depositBalance, setDepositBalance] = useState<number | null>(null);

  // USDT/VND rate for banking: use admin-set price when set, else fetch from CoinGecko
  useEffect(() => {
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
  }, [bankingConfig?.usdtPriceVnd]);

  const copyToClipboard = async (text: string, field: "bankName" | "accountNumber" | "accountName" | "content" | "walletAddress") => {
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
    loadCheckoutUser();
    calculateShippingFee();
    api.getBankingConfig().then((c) => setBankingConfig(c)).catch(() => setBankingConfig(null));

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
      // 1. Try API for basic info (includes Binary ID / username, ví nạp tiền)
      let walletBal: number | null = null;
      if (typeof api !== 'undefined') {
        try {
          const info = await api.getReferralInfo();
          userBase = {
            fullName: info.fullName || "Nguyễn Văn A",
            phone: info.phone || info.phoneNumber || "+84 912 345 678",
            username: info.username
          };
          const bal = info.walletBalance != null ? Number(info.walletBalance) : null;
          if (typeof bal === "number" && !Number.isNaN(bal)) walletBal = bal;
        } catch (e) {
          userBase = { fullName: "Nguyễn Văn A", phone: "+84 912 345 678", username: undefined };
        }
      }
      if (walletBal != null) setDepositBalance(walletBal);
      else if (typeof api?.getWalletBalance === "function") {
        try {
          const { balance } = await api.getWalletBalance();
          if (typeof balance === "number") setDepositBalance(balance);
        } catch { /* ignore */ }
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


  const handleDepositWalletOrder = async () => {
    if (!shippingAddress.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng");
      return;
    }
    const balance = depositBalance ?? 0;
    if (balance < finalTotal) {
      setError("Số dư ví nạp tiền không đủ. Vui lòng nạp thêm hoặc chọn Chuyển khoản.");
      return;
    }
    setProcessingStep("creating_order");
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Vui lòng đăng nhập");
      const orderData = await api.createOrder(
        items.map((item) => ({ productId: item.productId, quantity: item.quantity, properties: item.properties })),
        undefined,
        shippingAddress,
        "deposit_wallet",
        { shippingPhone: checkoutUser?.phone, shippingName: checkoutUser?.fullName }
      );
      setBankingOrderId(orderData.id);
      setProcessingStep("success");
      clearCart();
      apiCache.invalidate("referralInfo"); // để trang Ví / checkout lần sau hiển thị số dư mới
      setTimeout(() => router.push(`/home/orders?success=true&orderId=${orderData.id}`), 2500);
    } catch (err: any) {
      setError(err.message || "Đặt hàng thất bại");
      setProcessingStep("error");
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
        "banking",
        { shippingPhone: checkoutUser?.phone, shippingName: checkoutUser?.fullName }
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

  const handleUsdtOrder = async () => {
    if (!shippingAddress.trim()) {
      setError("Vui lòng nhập địa chỉ giao hàng");
      return;
    }
    if (!bankingConfig?.usdtEnabled || !bankingConfig?.usdtWalletAddress?.trim()) {
      setError("Phương thức USDT chưa được cấu hình. Vui lòng liên hệ admin.");
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
        "usdt",
        { shippingPhone: checkoutUser?.phone, shippingName: checkoutUser?.fullName }
      );
      setBankingOrderId(orderData.id);
      setProcessingStep("success");
      clearCart();
      setTimeout(() => {
        router.push(`/home/orders?success=true&orderId=${orderData.id}&usdt=1`);
      }, 4000);
    } catch (err: any) {
      setError(err.message || "Đặt hàng thất bại");
      setProcessingStep("error");
    }
  };

  const handlePayment = async () => {
    if (paymentTab === "deposit_wallet") await handleDepositWalletOrder();
    else if (paymentTab === "banking") await handleBankingOrder();
    else await handleUsdtOrder();
  };

  const canPayWithDepositWallet = (depositBalance ?? 0) >= finalTotal;

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

        {/* Section 2: Payment - Tab Ví nạp tiền | Chuyển khoản */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <span className="flex items-center justify-center size-6 rounded-full bg-primary text-white text-xs font-bold shadow-sm ring-2 ring-purple-100">2</span>
            <h2 className="text-base font-bold text-slate-700">{t("paymentMethod")}</h2>
          </div>

          {/* Tabs: Ví nạp tiền | Chuyển khoản */}
          <div className="bg-white rounded-2xl shadow-card border border-purple-100 overflow-hidden">
            <div className="grid grid-cols-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setPaymentTab("deposit_wallet")}
                className={`min-w-0 py-3 px-2 text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${paymentTab === "deposit_wallet"
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-slate-500 hover:bg-slate-50"
                  }`}
                title="Ví tiêu dùng"
              >
                <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                Ví tiêu dùng
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab("banking")}
                className={`min-w-0 py-3 px-2 text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${paymentTab === "banking"
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-slate-500 hover:bg-slate-50"
                  }`}
                title="Chuyển khoản ngân hàng"
              >
                <span className="material-symbols-outlined text-[18px]">account_balance</span>
                CK NH
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab("usdt")}
                className={`min-w-0 py-3 px-2 text-sm font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors ${paymentTab === "usdt"
                    ? "bg-primary/10 text-primary border-b-2 border-primary"
                    : "text-slate-500 hover:bg-slate-50"
                  }`}
                title="USDT"
              >
                <span className="material-symbols-outlined text-[18px]">currency_bitcoin</span>
                USDT
              </button>
            </div>

            {/* Nội dung tab Ví nạp tiền */}
            {paymentTab === "deposit_wallet" && (
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-600">Thanh toán bằng số dư ví nạp tiền. Đơn hàng được xác nhận ngay.</p>
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Số dư ví nạp tiền</p>
                  <p className="font-bold text-slate-900 text-lg">
                    {depositBalance != null ? formatPrice(depositBalance) : "—"} USDT
                  </p>
                </div>
                {depositBalance != null && (depositBalance < finalTotal) && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    Số dư không đủ ({formatPrice(finalTotal - depositBalance)} USDT thiếu). Vui lòng nạp thêm hoặc chọn Chuyển khoản.
                  </div>
                )}
              </div>
            )}

            {/* Nội dung tab Chuyển khoản */}
            {paymentTab === "banking" && (
              <>
                {!bankingConfig?.isEnabled && (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Phương thức chuyển khoản tạm thời không khả dụng. Vui lòng liên hệ admin.
                  </div>
                )}
                {bankingConfig && bankingConfig.isEnabled && (
                  <div className="p-4 space-y-4">
                    <p className="text-sm text-slate-600">Chuyển khoản đến tài khoản sau. Đơn hàng sẽ ở trạng thái chờ duyệt cho đến khi admin xác nhận đã nhận tiền.</p>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 font-medium mb-0.5">Số tiền chuyển khoản</p>
                      <p className="font-bold text-slate-900 text-lg">{formatPrice(finalTotal)} USDT</p>
                      {usdtToVnd != null && (
                        <p className="text-sm text-slate-600 mt-0.5">≈ {formatVnd(finalTotal * usdtToVnd)} </p>
                      )}
                      {usdtToVnd == null && (
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
              </>
            )}
            {paymentTab === "usdt" && (
              <>
                {!bankingConfig?.usdtEnabled && (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    Thanh toán USDT tạm thời không khả dụng. Vui lòng liên hệ admin.
                  </div>
                )}
                {bankingConfig?.usdtEnabled && (
                  <div className="p-4 space-y-4">
                    <p className="text-sm text-slate-600">
                      Chuyển đúng số USDT đến ví bên dưới. Đơn hàng sẽ ở trạng thái chờ duyệt cho đến khi admin xác nhận.
                    </p>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                      <p className="text-xs text-slate-500 font-medium mb-0.5">Số tiền USDT cần chuyển</p>
                      <p className="font-bold text-slate-900 text-lg">{formatPrice(finalTotal)} USDT</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Network</p>
                        <p className="font-bold text-slate-900">{bankingConfig.usdtNetwork || "TRC20"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 font-medium">Địa chỉ ví USDT</p>
                        <div className="flex items-start gap-2">
                          <code className="flex-1 min-w-0 font-mono text-xs sm:text-sm text-slate-900 break-all">
                            {bankingConfig.usdtWalletAddress || "—"}
                          </code>
                          {!!bankingConfig.usdtWalletAddress && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(bankingConfig.usdtWalletAddress || "", "walletAddress")}
                              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                            >
                              {copiedField === "walletAddress" ? "Đã copy" : <><span className="material-symbols-outlined text-[14px]">content_copy</span> Copy</>}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {bankingConfig.usdtQrImageUrl && (
                      <div className="flex flex-col items-center pt-2">
                        <span className="text-xs text-text-sub font-medium mb-2">Quét QR để chuyển USDT</span>
                        <img src={bankingConfig.usdtQrImageUrl} alt="QR USDT" className="w-64 h-64 min-w-[256px] min-h-[256px] object-contain rounded-lg border border-slate-200 bg-white" />
                        <a
                          href={bankingConfig.usdtQrImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          Mở / tải ảnh QR
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
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
            {usdtToVnd != null && (
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
            {usdtToVnd != null && (
              <span className="text-xs text-slate-500 mt-0.5">≈ {formatVnd(finalTotal * usdtToVnd)}</span>
            )}
          </div>
          <button
            onClick={handlePayment}
            disabled={
              processingStep !== "idle" ||
              (paymentTab === "deposit_wallet" && !canPayWithDepositWallet) ||
              (paymentTab === "banking" && !bankingConfig?.isEnabled) ||
              (paymentTab === "usdt" && (!bankingConfig?.usdtEnabled || !bankingConfig?.usdtWalletAddress))
            }
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl h-12 flex items-center justify-center gap-2 shadow-float transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>
              {processingStep !== "idle" ? t("processingPayment") : "Đặt hàng"}
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
          processingStep === "success" && bankingOrderId && (paymentTab === "banking" || paymentTab === "usdt")
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
