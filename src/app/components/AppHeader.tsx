"use client";

import React from "react";
import LanguageSelect from "@/app/components/LanguageSelect";
import { useI18n } from "@/app/i18n/I18nProvider";

export default function AppHeader({
  titleKey = "homeTitle",
  right,
  theme = "light",
}: {
  titleKey?: "homeTitle" | "appName";
  right?: React.ReactNode;
  theme?: "light" | "dark";
}) {
  const { t } = useI18n();

  const isDark = theme === "dark";

  return (
    <header className={`sticky top-0 z-40 ${isDark ? "bg-transparent" : "bg-white shadow-sm"}`}>
      <div className="mx-auto max-w-2xl px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className={`text-xl font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{t(titleKey)}</h1>
          <div className="flex items-center gap-3">
            {right}
            <LanguageSelect />
          </div>
        </div>
      </div>
    </header>
  );
}


