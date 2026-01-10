"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";
import { handleAuthError } from "@/app/utils/auth";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [userInfo, setUserInfo] = useState<{ fullName?: string; username?: string; avatar?: string } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    loadUserProfile();
    loadWalletStatus();
  }, []);

  const loadUserProfile = async () => {
    try {
      // Try to get info from API
      if (typeof api !== 'undefined') {
          try {
            const info = await api.getReferralInfo();
            // Get local avatar as fallback
            const localAvatar = localStorage.getItem("userAvatar");
            setUserInfo({
                ...info,
                avatar: info.avatar || localAvatar
            });
          } catch(e: any) {
             // Check if it's an authentication error and redirect
             if (handleAuthError(e, router)) {
               return; // Redirect is happening
             }
             // Fallback to local storage or defaults
             const savedPhone = localStorage.getItem("userPhone");
             const savedName = localStorage.getItem("userName");
             const savedAvatar = localStorage.getItem("userAvatar");
             setUserInfo({
                fullName: savedName || "Nguyễn Văn A",
                username: savedPhone || "99887722",
                avatar: savedAvatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA"
             });
          }
      }
    } catch (err) {
    }
  };

  const loadWalletStatus = () => {
      // Check localStorage first
      const storedAddr = localStorage.getItem("walletAddress");
      if (storedAddr) {
          setWalletAddress(storedAddr);
          return;
      }
      
      // Check window.ethereum
      if (typeof window !== "undefined" && (window as any).ethereum) {
           const eth = (window as any).ethereum;
           if (eth.selectedAddress) {
               setWalletAddress(eth.selectedAddress);
           }
      }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("walletAddress");
    router.push("/");
  };

  return (
    <div className="bg-white text-slate-900 min-h-screen flex flex-col font-display">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center justify-between p-4 h-16 max-w-md mx-auto w-full">
          <button 
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full active:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-900">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">{t("profileTitle")}</h1>
          <div className="w-10"></div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-md mx-auto pb-32">
        <section className="flex flex-col items-center py-8 px-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-white p-0.5 bg-white overflow-hidden shadow-lg ring-1 ring-slate-100">
              <div 
                className="w-full h-full rounded-full bg-center bg-cover" 
                style={{backgroundImage: `url("${userInfo?.avatar || "https://lh3.googleusercontent.com/aida-public/AB6AXuAkJa2DRzw6szvW3OTTY4LTkdz1KpLIEcoyCXBoTV7CT-eukbKk9cfspmJv1RVPzMKLhFZFMV4puf9YFTK8Fp_Mj14V_JeL9gylhtB6HENgUVJjPRiNaoI1FsEnLLPfSI9welU7uVGKBDArGQ15eWv3yQa364BAB17-FI2JhO83NiBhrdKd3IJdtqv3n6GhopqhsrPFXrk-M0Dy8RwfR7jhlpV8WMebFYshuA9H2HoYOqv6IxJp0zI6lQpthNG8y9CnSYPaA8p48CA"}")`}}
              >
              </div>
            </div>
            <div className="absolute bottom-1 right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm"></div>
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-2xl font-bold text-slate-900">{userInfo?.fullName || "Nguyễn Văn A"}</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-slate-500 text-sm font-medium">Binary ID: {userInfo?.username || "99887722"}</span>
              <span className="bg-blue-50 text-[#135bec] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>
            </div>
            
            {walletAddress ? (
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="material-symbols-outlined text-[#135bec] text-xl">account_balance_wallet</span>
                  <span className="text-xs font-semibold text-slate-600">{t("connectedToSafePal")}</span>
                  <div className="w-2 h-2 rounded-full bg-[#135bec] animate-pulse"></div>
                </div>
            ) : (
                <button 
                    onClick={() => {
                        // Logic to connect wallet could be triggered here or navigating to wallet page
                        router.push('/home/wallets');
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100"
                >
                  <span className="material-symbols-outlined text-slate-400 text-xl">account_balance_wallet</span>
                  <span className="text-xs font-semibold text-slate-600">{t("connectWallet")}</span>
                </button>
            )}
          </div>
        </section>

        <section className="px-4 space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <button 
                onClick={() => router.push('/home/profile/edit')}
                className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#135bec]/10 text-[#135bec]">
                <span className="material-symbols-outlined text-xl font-medium">person</span>
              </div>
              <span className="flex-1 font-medium text-slate-800 text-left">{t("editProfile")}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <div className="mx-4 border-t border-slate-50"></div>
            <button 
                onClick={() => router.push('/home/profile/address')}
                className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
                <span className="material-symbols-outlined text-xl font-medium">location_on</span>
              </div>
              <span className="flex-1 font-medium text-slate-800 text-left">{t("shippingAddress")}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <div className="mx-4 border-t border-slate-50"></div>
            <button 
                onClick={() => router.push('/home/orders')}
                className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">
                <span className="material-symbols-outlined text-xl font-medium">history</span>
              </div>
              <span className="flex-1 font-medium text-slate-800 text-left">{t("orderHistoryNav")}</span>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
            <button className="w-full flex items-center gap-4 px-4 py-4 active:bg-slate-50 transition-colors">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600">
                <span className="material-symbols-outlined text-xl font-medium">shield</span>
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-slate-800">{t("security")}</p>
                <p className="text-xs text-slate-400">{t("security2FA")}</p>
              </div>
              <span className="material-symbols-outlined text-slate-300">chevron_right</span>
            </button>
            <div className="mx-4 border-t border-slate-50"></div>
            <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-4 py-4 active:bg-red-50 transition-colors text-red-500"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-xl font-medium">logout</span>
              </div>
              <span className="flex-1 font-semibold text-left">{t("logout")}</span>
            </button>
          </div>
        </section>

        <div className="mt-8 text-center px-4">
          <p className="text-[11px] text-slate-400 font-medium tracking-wide">GROCERY DAPP v2.1.0 • BINARY ECOSYSTEM</p>
        </div>
      </main>
    </div>
  );
}
