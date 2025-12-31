"use client";

import React from "react";
import { useI18n } from "@/app/i18n/I18nProvider";
import type { Lang } from "@/app/i18n/dict";

export default function LanguageSelect({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { lang, setLang } = useI18n();
  const isDark = variant === "dark";

  return (
    <select
      aria-label="Language"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className={
        isDark
          ? "h-9 rounded-lg border border-white/30 bg-white/10 px-2 text-sm text-white backdrop-blur-sm outline-none transition-colors hover:bg-white/20"
          : "h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors hover:bg-zinc-50"
      }
    >
      <option value="vi">VI</option>
      <option value="en">EN</option>
      <option value="ko">KO</option>
    </select>
  );
}


