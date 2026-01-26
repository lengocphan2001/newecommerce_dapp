"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/app/services/api";
import { useI18n } from "@/app/i18n/I18nProvider";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || token.trim() === "") {
      setStatus("error");
      setMessage(typeof t("verifyEmailMissingToken") === "string" ? t("verifyEmailMissingToken") : "Missing verification link.");
      return;
    }
    api
      .verifyEmail(token)
      .then((res: { message?: string; email?: string }) => {
        setStatus("success");
        setMessage(res.message || (res.email ? `Email ${res.email} verified.` : "Email verified successfully."));
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message || "Verification failed.");
      });
  }, [token, t]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-soft p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-violet-100 text-violet-600 mb-4">
              <span className="material-symbols-outlined text-3xl animate-pulse">mark_email_unread</span>
            </div>
            <p className="text-text-main font-medium">{t("verifying")}</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-green-100 text-green-600 mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <h1 className="text-xl font-semibold text-text-main mb-2">{t("verifyEmailSuccess")}</h1>
            <p className="text-text-sub text-sm mb-6">{message}</p>
            <button
              onClick={() => router.push("/home/account")}
              className="w-full py-3 px-4 rounded-lg bg-violet-600 text-white font-medium hover:bg-violet-700"
            >
              {t("backToAccount")}
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-red-100 text-red-600 mb-4">
              <span className="material-symbols-outlined text-3xl">error</span>
            </div>
            <h1 className="text-xl font-semibold text-text-main mb-2">{t("verifyEmailFailed")}</h1>
            <p className="text-text-sub text-sm mb-6">{message}</p>
            <button
              onClick={() => router.push("/home/account")}
              className="w-full py-3 px-4 rounded-lg border border-gray-300 text-text-main font-medium hover:bg-gray-50"
            >
              {t("backToAccount")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-soft p-8 max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center size-16 rounded-full bg-violet-100 text-violet-600 mb-4 animate-pulse">
              <span className="material-symbols-outlined text-3xl">mark_email_unread</span>
            </div>
            <p className="text-text-main font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
