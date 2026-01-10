import React from "react";
import { useI18n } from "@/app/i18n/I18nProvider";

export type ProcessingStep = "idle" | "confirming" | "processing" | "creating_order" | "success" | "error";

interface TransactionProcessingModalProps {
  isOpen: boolean;
  step: ProcessingStep;
  error?: string;
  onClose?: () => void;
}

export default function TransactionProcessingModal({
  isOpen,
  step,
  error,
  onClose,
}: TransactionProcessingModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
        
        {/* Icon Area */}
        <div className="flex justify-center">
          {step === "confirming" && (
            <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-4xl text-blue-600">account_balance_wallet</span>
            </div>
          )}
          {(step === "processing" || step === "creating_order") && (
            <div className="relative size-16">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <span className="material-symbols-outlined text-2xl text-blue-600">sync</span>
              </div>
            </div>
          )}
          {step === "success" && (
            <div className="size-16 rounded-full bg-green-100 flex items-center justify-center animate-[bounce_1s_infinite]">
              <span className="material-symbols-outlined text-4xl text-green-600">check_circle</span>
            </div>
          )}
          {step === "error" && (
            <div className="size-16 rounded-full bg-red-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-red-600">error</span>
            </div>
          )}
        </div>

        {/* Text Area */}
        <div className="space-y-2">
            {step === "confirming" && (
                <>
                    <h3 className="text-xl font-bold text-slate-800">{t("confirmingTitle")}</h3>
                    <p className="text-slate-500 text-sm">{t("confirmingMessage")}</p>
                </>
            )}
            {step === "processing" && (
                <>
                    <h3 className="text-xl font-bold text-slate-800">{t("processingTitle")}</h3>
                    <p className="text-slate-500 text-sm">{t("processingMessage")}</p>
                    <p className="text-xs text-blue-600 font-medium bg-blue-50 py-1 px-2 rounded-lg inline-block mt-2">{t("pleaseDoNotCloseBrowser")}</p>
                </>
            )}
            {step === "creating_order" && (
                <>
                    <h3 className="text-xl font-bold text-slate-800">{t("creatingOrderTitle")}</h3>
                    <p className="text-slate-500 text-sm">{t("creatingOrderMessage")}</p>
                </>
            )}
            {step === "success" && (
                <>
                    <h3 className="text-xl font-bold text-slate-800">{t("paymentSuccessTitle")}</h3>
                    <p className="text-slate-500 text-sm">{t("paymentSuccessMessage")}</p>
                </>
            )}
            {step === "error" && (
                <>
                    <h3 className="text-xl font-bold text-slate-800">{t("paymentFailedTitle")}</h3>
                    <p className="text-red-500 text-sm font-medium">{error || t("errorOccurred")}</p>
                </>
            )}
        </div>

        {/* Action Area (Only for error) */}
        {step === "error" && onClose && (
            <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
            >
                {t("close")}
            </button>
        )}
      </div>
    </div>
  );
}
