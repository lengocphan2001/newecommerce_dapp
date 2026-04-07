"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

export default function EditProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBQffTSr_qe4oi_yS3HAoWFsf7w2w9llbONDMakuC8IPT53Ok7EgJpO0AFzkCfQ8Qi-Pro4LeASHD0AKWxRxR9iKB800muBJQec9x0cpVtXJsiSxDwDgDCdlIgKgmnAa7zpO_pqpJ-lFyibXcZSqlN1bzNXFKL1BLwFs150ViBLuT3TnlRgfX36lGbdbPSSg70FlD67_WFrzkdlgxPomFer9947GUO4nkQRlsaV6N-Ncsp1W5XK8vvv1GYh0_kK6jm0ObYKE3Fh7ak",
    walletAddress: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankForm, setBankForm] = useState({
    id: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    bankCode: '',
    qrImageUrl: '',
    isDefault: false,
  });
  const [bankLoading, setBankLoading] = useState(false);
  const [bankQrUploading, setBankQrUploading] = useState(false);
  const [bankMessage, setBankMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadUserData();
    loadBankAccounts();
  }, []);

  const loadUserData = async () => {
    try {
      const storedPhone = localStorage.getItem("userPhone");
      const storedAvatar = localStorage.getItem("userAvatar");
      const storedName = localStorage.getItem("userName");
      const storedEmail = localStorage.getItem("userEmail");

      if (typeof api !== "undefined") {
        try {
          const info = await api.getReferralInfo();
          setFormData((prev) => ({
            ...prev,
            displayName: info.fullName || storedName || "Nguyễn Văn A",
            phone: info.phoneNumber || info.phone || storedPhone || "",
            email: info.email || storedEmail || "",
            avatar: info.avatar || storedAvatar || prev.avatar,
            walletAddress: info.walletAddress || "",
          }));
          return;
        } catch (e) {}
      }

      setFormData((prev) => ({
        ...prev,
        displayName: storedName || "Nguyễn Văn A",
        phone: storedPhone || "",
        email: storedEmail || "",
        avatar: storedAvatar || prev.avatar,
      }));
    } catch (error) {}
  };

  const loadBankAccounts = async () => {
    try {
      const list = await api.getMyBankAccounts();
      setBankAccounts(Array.isArray(list) ? list : []);
    } catch (e) {
      setBankAccounts([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const compressImage = (file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setMessage({ type: 'error', text: t("imageTooLarge") || "Image size must be less than 10MB" });
        return;
      }

      try {
        setUploadingAvatar(true);

        // Compress image before upload
        const compressedFile = await compressImage(file, 800, 800, 0.8);

        // Show preview immediately
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, avatar: reader.result as string }));
        };
        reader.readAsDataURL(compressedFile);

        // Upload compressed file
        const avatarUrl = await api.uploadAvatar(compressedFile);
        setFormData(prev => ({ ...prev, avatar: avatarUrl }));
        setSelectedFile(null); // Clear after successful upload
        setMessage({ type: 'success', text: t("avatarUploaded") });
        setTimeout(() => setMessage(null), 2000);
      } catch (err: any) {
        setMessage({ type: 'error', text: err.message || t("avatarUploadFailed") });
        // Keep preview but mark that upload failed
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      let avatarUrl = formData.avatar;

      // If there's a selected file that hasn't been uploaded yet, upload it first
      if (selectedFile) {
        try {
          avatarUrl = await api.uploadAvatar(selectedFile);
          setFormData(prev => ({ ...prev, avatar: avatarUrl }));
          setSelectedFile(null);
        } catch (err: any) {
          setMessage({ type: 'error', text: err.message || t("avatarUploadFailed") });
          setLoading(false);
          return;
        }
      }

      await api.updateProfile({
        fullName: formData.displayName,
        email: formData.email,
        phoneNumber: formData.phone,
        avatar: avatarUrl,
        walletAddress: formData.walletAddress || undefined,
      });

      localStorage.setItem("userPhone", formData.phone);
      localStorage.setItem("userName", formData.displayName);
      localStorage.setItem("userEmail", formData.email);
      localStorage.setItem("userAvatar", avatarUrl);
      if (formData.walletAddress) {
        localStorage.setItem("walletAddress", formData.walletAddress);
      }

      setMessage({ type: 'success', text: t("profileUpdated") });

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || t("updateFailed") });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);
    if (!passwordForm.currentPassword.trim()) {
      setPasswordMessage({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại' });
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới tối thiểu 6 ký tự' });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
      return;
    }
    setPasswordLoading(true);
    try {
      await api.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordMessage({ type: 'success', text: 'Đã đổi mật khẩu thành công' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Đổi mật khẩu thất bại' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const resetBankForm = () => {
    setBankForm({
      id: '',
      bankName: '',
      accountNumber: '',
      accountName: '',
      bankCode: '',
      qrImageUrl: '',
      isDefault: bankAccounts.length === 0,
    });
  };

  const handleEditBank = (item: any) => {
    setBankForm({
      id: item.id || '',
      bankName: item.bankName || '',
      accountNumber: item.accountNumber || '',
      accountName: item.accountName || '',
      bankCode: item.bankCode || '',
      qrImageUrl: item.qrImageUrl || '',
      isDefault: Boolean(item.isDefault),
    });
  };

  const handleBankQrChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBankQrUploading(true);
    setBankMessage(null);
    try {
      const { url } = await api.uploadDepositProof(file);
      setBankForm((f) => ({ ...f, qrImageUrl: url }));
    } catch (err: any) {
      setBankMessage({ type: 'error', text: err?.message || 'Tải QR thất bại' });
    } finally {
      setBankQrUploading(false);
    }
  };

  const handleSaveBank = async () => {
    setBankMessage(null);
    if (!bankForm.bankName || !bankForm.accountNumber || !bankForm.accountName) {
      setBankMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ tên ngân hàng, số tài khoản, chủ tài khoản' });
      return;
    }
    if (!bankForm.qrImageUrl) {
      setBankMessage({ type: 'error', text: 'Vui lòng tải lên QR thanh toán của tài khoản ngân hàng' });
      return;
    }
    setBankLoading(true);
    try {
      const payload = {
        bankName: bankForm.bankName,
        accountNumber: bankForm.accountNumber,
        accountName: bankForm.accountName,
        bankCode: bankForm.bankCode || undefined,
        qrImageUrl: bankForm.qrImageUrl,
        isDefault: bankForm.isDefault,
      };
      if (bankForm.id) {
        await api.updateBankAccount(bankForm.id, payload);
      } else {
        await api.createBankAccount(payload);
      }
      await loadBankAccounts();
      resetBankForm();
      setBankMessage({ type: 'success', text: 'Đã lưu tài khoản ngân hàng' });
    } catch (err: any) {
      setBankMessage({ type: 'error', text: err?.message || 'Lưu tài khoản ngân hàng thất bại' });
    } finally {
      setBankLoading(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Xóa tài khoản ngân hàng này?')) return;
    try {
      await api.deleteBankAccount(id);
      await loadBankAccounts();
      if (bankForm.id === id) resetBankForm();
      setBankMessage({ type: 'success', text: 'Đã xóa tài khoản ngân hàng' });
    } catch (err: any) {
      if (handleAuthError(err, router)) return;
      setBankMessage({ type: 'error', text: err?.message || 'Xóa tài khoản thất bại' });
    }
  };

  return (
    <div className="bg-[#f6f6f8] text-[#0d121b] min-h-screen flex flex-col font-display selection:bg-yellow-100 selection:text-yellow-900">

      {/* TopAppBar */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-[0_1px_3px_rgba(240,185,11,0.15)]">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-yellow-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900">{t("editProfileTitle")}</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center justify-center p-2 -mr-2 rounded-full hover:bg-yellow-50 transition-colors">
            <span className="material-symbols-outlined text-slate-800">filter_list</span>
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto pb-32">
        {/* ProfileHeader / Avatar Section */}
        <div className="flex p-6 w-full justify-center">
          <div className="flex w-full flex-col gap-4 items-center">
            <div className="relative flex gap-4 flex-col items-center group cursor-pointer" onClick={handleAvatarClick}>
              <div className="relative">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 border-4 border-white shadow-sm transition-transform group-active:scale-95 duration-200"
                  style={{ backgroundImage: `url("${formData.avatar}")` }}
                >
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                {/* Edit Badge */}
                <div className={`absolute bottom-1 right-1 bg-[#135bec] text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center ${uploadingAvatar ? 'opacity-50' : ''}`}>
                  <span className="material-symbols-outlined text-sm">
                    {uploadingAvatar ? 'hourglass_empty' : 'photo_camera'}
                  </span>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  disabled={uploadingAvatar}
                />
              </div>
              <button
                className={`text-[#135bec] text-sm font-medium leading-normal text-center hover:opacity-80 transition-opacity ${uploadingAvatar ? 'opacity-50 cursor-wait' : ''}`}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? t("uploading") : t("changeAvatar")}
              </button>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="px-4 space-y-2">

          {/* Display Name Field */}
          <div className="flex flex-col w-full py-3">
            <label className="flex flex-col w-full">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">{t("displayName")}</p>
              <input
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-14 placeholder:text-[#4c669a] p-[15px] text-base font-normal leading-normal transition-all"
                placeholder={t("enterYourName")}
                type="text"
              />
            </label>
          </div>

          {/* Email Field */}
          <div className="flex flex-col w-full py-3">
            <label className="flex flex-col w-full">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">{t("email")}</p>
              <input
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-14 placeholder:text-[#4c669a] p-[15px] text-base font-normal leading-normal transition-all"
                placeholder="example@gmail.com"
                type="email"
              />
            </label>
          </div>

          {/* Phone Field */}
          <div className="flex flex-col w-full py-3">
            <label className="flex flex-col w-full">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">{t("phoneNumber")}</p>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-14 placeholder:text-[#4c669a] p-[15px] text-base font-normal leading-normal transition-all"
                placeholder={t("enterPhone")}
                type="tel"
              />
            </label>
          </div>

          {/* Địa chỉ ví nhận hoa hồng (điền tay, không kết nối ví) */}
          <div className="flex flex-col w-full py-3">
            <label className="flex flex-col w-full">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">Địa chỉ ví nhận hoa hồng</p>
              <input
                name="walletAddress"
                value={formData.walletAddress}
                onChange={handleInputChange}
                className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-14 placeholder:text-[#4c669a] p-[15px] text-base font-mono leading-normal transition-all"
                placeholder="0x..."
                type="text"
              />
              <p className="text-xs text-slate-500 mt-1 ml-1">Dùng để nhận hoa hồng (USDT BEP20). Có thể để trống.</p>
            </label>
          </div>

          {/* Đổi mật khẩu */}
          <div className="flex flex-col w-full py-3 mt-4 border-t border-[#cfd7e7]">
            <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-3 ml-1">Đổi mật khẩu</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 ml-1">Mật khẩu hiện tại</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                  className="form-input w-full rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 ml-1">Mật khẩu mới</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                  className="form-input w-full rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 ml-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmNewPassword: e.target.value }))}
                  className="form-input w-full rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>
            {passwordMessage && (
              <div className={`mt-2 p-3 rounded-xl text-sm font-medium ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {passwordMessage.text}
              </div>
            )}
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={passwordLoading}
              className="mt-3 w-full rounded-xl border-2 border-[#135bec] text-[#135bec] font-bold py-3 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {passwordLoading && <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>}
              {passwordLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </div>

          {/* Cấu hình ngân hàng nhận rút tiền */}
          <div className="flex flex-col w-full py-3 mt-4 border-t border-[#cfd7e7]">
            <div className="flex items-center justify-between pb-3">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal ml-1">Tài khoản ngân hàng nhận rút tiền</p>
              <button
                type="button"
                onClick={resetBankForm}
                className="text-xs text-primary-dark font-medium"
              >
                + Thêm mới
              </button>
            </div>

            {bankAccounts.length > 0 ? (
              <div className="space-y-2 mb-3">
                {bankAccounts.map((b: any) => (
                  <div key={b.id} className="rounded-xl border border-[#cfd7e7] bg-white p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {b.bankName} {b.isDefault ? '(Mặc định)' : ''}
                        </p>
                        <p className="text-xs text-slate-600">{b.accountName} - {b.accountNumber}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => handleEditBank(b)} className="text-xs text-primary-dark font-medium">
                          Sửa
                        </button>
                        <button type="button" onClick={() => handleDeleteBank(b.id)} className="text-xs text-red-600 font-medium">
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 pb-3 ml-1">Bạn chưa thêm tài khoản ngân hàng nào.</p>
            )}

            <div className="space-y-2">
              <input
                value={bankForm.bankName}
                onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
                className="form-input w-full rounded-xl border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                placeholder="Tên ngân hàng"
              />
              <input
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))}
                className="form-input w-full rounded-xl border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                placeholder="Số tài khoản"
              />
              <input
                value={bankForm.accountName}
                onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
                className="form-input w-full rounded-xl border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                placeholder="Chủ tài khoản"
              />
              <input
                value={bankForm.bankCode}
                onChange={(e) => setBankForm((f) => ({ ...f, bankCode: e.target.value }))}
                className="form-input w-full rounded-xl border border-[#cfd7e7] bg-white h-12 px-3 text-base"
                placeholder="Mã ngân hàng (tùy chọn)"
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 px-1">QR thanh toán *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBankQrChange}
                  className="hidden"
                  id="profile-bank-qr-upload"
                />
                <label
                  htmlFor="profile-bank-qr-upload"
                  className="flex items-center justify-center py-2.5 px-4 rounded-xl border border-dashed border-[#cfd7e7] cursor-pointer text-sm text-[#135bec] bg-white"
                >
                  {bankQrUploading
                    ? 'Đang tải QR...'
                    : bankForm.qrImageUrl
                      ? '✓ Đã tải QR (Bấm để đổi)'
                      : 'Chọn ảnh QR ngân hàng'}
                </label>
                {bankForm.qrImageUrl && (
                  <img
                    src={bankForm.qrImageUrl}
                    alt="Bank QR"
                    className="mt-2 w-24 h-24 object-contain rounded border border-[#cfd7e7] bg-white"
                  />
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 px-1">
                <input
                  type="checkbox"
                  checked={bankForm.isDefault}
                  onChange={(e) => setBankForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Đặt làm mặc định
              </label>
              {bankMessage && (
                <div className={`p-3 rounded-xl text-sm font-medium ${bankMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {bankMessage.text}
                </div>
              )}
              <button
                type="button"
                onClick={handleSaveBank}
                disabled={bankLoading}
                className="w-full rounded-xl border-2 border-[#135bec] text-[#135bec] font-bold py-3 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {bankLoading ? 'Đang lưu...' : bankForm.id ? 'Cập nhật tài khoản ngân hàng' : 'Lưu tài khoản ngân hàng'}
              </button>
            </div>
          </div>

          {/* Message Toast */}
          {message && (
            <div className={`p-4 rounded-xl text-sm font-semibold text-center mb-2 animate-pulse ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <div className="py-6">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-yellow-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>}
              {loading ? t("saving") : t("saveChanges")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
