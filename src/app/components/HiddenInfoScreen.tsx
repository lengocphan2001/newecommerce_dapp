"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/app/i18n/I18nProvider";

/** Full page shown in place of a screen the admin has hidden from users. */
export default function HiddenInfoScreen({ title }: { title: string }) {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex flex-col bg-background-light min-h-screen">
      <header className="flex items-center px-4 py-3 sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-emerald-50 transition-colors"
        >
          <span className="material-symbols-outlined text-slate-800">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight text-center flex-1 text-slate-900 pr-8">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span className="material-symbols-outlined text-5xl text-gray-300">visibility_off</span>
        <p className="text-sm text-gray-500">{t("infoHidden")}</p>
      </div>
    </div>
  );
}
