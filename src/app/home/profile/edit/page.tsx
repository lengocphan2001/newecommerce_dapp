"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";

export default function EditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBQffTSr_qe4oi_yS3HAoWFsf7w2w9llbONDMakuC8IPT53Ok7EgJpO0AFzkCfQ8Qi-Pro4LeASHD0AKWxRxR9iKB800muBJQec9x0cpVtXJsiSxDwDgDCdlIgKgmnAa7zpO_pqpJ-lFyibXcZSqlN1bzNXFKL1BLwFs150ViBLuT3TnlRgfX36lGbdbPSSg70FlD67_WFrzkdlgxPomFer9947GUO4nkQRlsaV6N-Ncsp1W5XK8vvv1GYh0_kK6jm0ObYKE3Fh7ak"
  });
  
  const [walletAddress, setWalletAddress] = useState("0x71C...8e92");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Load from localStorage as initial state
      const storedPhone = localStorage.getItem("userPhone");
      const storedAddress = localStorage.getItem("walletAddress");
      const storedAvatar = localStorage.getItem("userAvatar");
      const storedName = localStorage.getItem("userName");
      const storedEmail = localStorage.getItem("userEmail");

      if (storedAddress) {
        setWalletAddress(shortAddress(storedAddress));
      }

      // Try API if available
      if (typeof api !== 'undefined') {
          try {
             const info = await api.getReferralInfo();
             setFormData(prev => ({
                 ...prev,
                 displayName: info.fullName || storedName || "Nguyễn Văn A",
                 phone: info.phoneNumber || info.phone || storedPhone || "",
                 email: info.email || storedEmail || "vana.nguyen@safepal.io",
                 avatar: info.avatar || storedAvatar || prev.avatar
             }));
             return;
          } catch(e) {
             console.warn("API load error", e);
          }
      }

      // Fallback
      setFormData(prev => ({
          ...prev,
          displayName: storedName || "Nguyễn Văn A",
          phone: storedPhone || "",
          email: storedEmail || "vana.nguyen@safepal.io",
          avatar: storedAvatar || prev.avatar
      }));

    } catch (error) {
      console.error(error);
    }
  };

  const shortAddress = (addr: string) => {
      if (!addr) return "Not connected";
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          setMessage({ type: 'error', text: 'Ảnh quá lớn (Max 5MB)' });
          return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Call API
      await api.updateProfile({
          fullName: formData.displayName,
          email: formData.email,
          phoneNumber: formData.phone,
          avatar: formData.avatar
      });

      // Update localStorage for consistency
      localStorage.setItem("userPhone", formData.phone);
      localStorage.setItem("userName", formData.displayName);
      localStorage.setItem("userEmail", formData.email);
      localStorage.setItem("userAvatar", formData.avatar);
      
      setMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
      
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Cập nhật thất bại. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#f6f6f8] text-[#0d121b] min-h-screen flex flex-col font-display selection:bg-blue-100 selection:text-blue-900">
      
      {/* TopAppBar */}
      <header className="sticky top-0 z-10 flex items-center bg-white/90 backdrop-blur-md p-4 pb-2 justify-between border-b border-gray-100">
        <button 
            onClick={() => router.back()}
            aria-label="Back" 
            className="text-[#0d121b] flex size-12 shrink-0 items-center justify-start rounded-full active:bg-gray-100 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </button>
        <h2 className="text-[#0d121b] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Chỉnh sửa hồ sơ</h2>
        <div className="size-12"></div>
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
                    style={{backgroundImage: `url("${formData.avatar}")`}}
                ></div>
                {/* Edit Badge */}
                <div className="absolute bottom-1 right-1 bg-[#135bec] text-white p-2 rounded-full shadow-lg border-2 border-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">photo_camera</span>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                />
              </div>
              <button className="text-[#135bec] text-sm font-medium leading-normal text-center hover:opacity-80 transition-opacity">
                Thay đổi ảnh đại diện
              </button>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="px-4 space-y-2">
          
          {/* Display Name Field */}
          <div className="flex flex-col w-full py-3">
            <label className="flex flex-col w-full">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">Tên hiển thị</p>
              <input 
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-14 placeholder:text-[#4c669a] p-[15px] text-base font-normal leading-normal transition-all" 
                placeholder="Nhập tên của bạn" 
                type="text" 
              />
            </label>
          </div>

          {/* Email Field */}
          <div className="flex flex-col w-full py-3">
            <label className="flex flex-col w-full">
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">Email</p>
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
              <p className="text-[#0d121b] text-sm font-semibold leading-normal pb-2 ml-1">Số điện thoại</p>
              <input 
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-input flex w-full min-w-0 flex-1 rounded-xl text-[#0d121b] focus:outline-0 focus:ring-2 focus:ring-[#135bec]/20 border border-[#cfd7e7] bg-white h-14 placeholder:text-[#4c669a] p-[15px] text-base font-normal leading-normal transition-all" 
                placeholder="09xx xxx xxx" 
                type="tel" 
              />
            </label>
          </div>

          {/* DApp Wallet Context (Read-only) */}
          <div className="flex flex-col w-full py-3 mt-2">
            <div className="bg-[#135bec]/5 rounded-xl p-4 border border-[#135bec]/20">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg text-[#135bec]">
                  <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#135bec] opacity-70">Ví SafePal đã liên kết</p>
                  <p className="text-xs font-mono text-[#4c669a] truncate">{walletAddress}</p>
                </div>
                <span className="material-symbols-outlined text-green-500 text-xl filled" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
              </div>
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
                className="w-full bg-[#135bec] hover:bg-[#135bec]/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {loading && <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>}
                {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
