"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { useI18n } from "@/app/i18n/I18nProvider";
import { api } from "@/app/services/api";

export default function AccountPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("");

  useEffect(() => {
    api.getReferralInfo().then((res: { emailVerified?: boolean }) => {
      setEmailVerified(!!res.emailVerified);
    }).catch(() => setEmailVerified(null));
  }, []);

  const handleSendVerification = () => {
    setSendingVerify(true);
    setVerifyMessage("");
    api.sendVerificationEmail()
      .then((res: { message?: string; verifyUrl?: string }) => {
        setVerifyMessage(res.verifyUrl ? `${res.message}. Link: ${res.verifyUrl}` : (res.message || ""));
      })
      .catch((err: Error) => setVerifyMessage(err.message || "Failed"))
      .finally(() => setSendingVerify(false));
  };

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="navAccount" />
      <main className="flex-1 pb-24" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
          <button
            onClick={() => router.push("/home/profile")}
            className="w-full rounded-xl bg-white p-4 text-left shadow-sm transition-colors hover:bg-zinc-50"
          >
            <div className="flex items-center gap-4">
              <div className="text-zinc-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900">
                  {t("accountInfo")}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {t("viewEditAccountInfo")}
                </p>
              </div>
              <div className="text-zinc-400">&gt;</div>
            </div>
          </button>

          <div className="w-full rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-zinc-900 mb-2">
              {t("emailVerification")}
            </p>
            {emailVerified === true && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                {t("emailVerified")}
              </p>
            )}
            {emailVerified === false && (
              <>
                <p className="text-xs text-zinc-500 mb-3">{t("emailNotVerified")}</p>
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={sendingVerify}
                  className="text-sm py-2 px-3 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {sendingVerify ? "..." : t("sendVerificationEmail")}
                </button>
                {verifyMessage && (
                  <p className="text-xs text-zinc-600 mt-2 break-all">{verifyMessage}</p>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

