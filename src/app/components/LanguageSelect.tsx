"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/app/i18n/I18nProvider";
import type { Lang } from "@/app/i18n/dict";

export default function LanguageSelect({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { lang, setLang } = useI18n();
  const isDark = variant === "dark";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(
    () =>
      [
        { value: "vi" as const, label: "Tiếng Việt", short: "VI" },
        { value: "en" as const, label: "English", short: "EN" },
        { value: "ko" as const, label: "한국어", short: "KO" },
      ] satisfies Array<{ value: Lang; label: string; short: string }>,
    []
  );

  const current = options.find((o) => o.value === lang) ?? options[0];

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const buttonClass = isDark
    ? "inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition hover:bg-white/15 active:bg-white/20"
    : "inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-50 active:bg-zinc-100";

  const menuClass = isDark
    ? "absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#0b5f50]/90 shadow-xl backdrop-blur-md"
    : "absolute right-0 top-12 z-50 w-48 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl";

  const itemBase = isDark
    ? "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10"
    : "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-zinc-800 hover:bg-zinc-50";

  const activeItem = isDark ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-900";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass}
      >
        {/* Globe icon */}
        <svg
          className={isDark ? "h-5 w-5 text-white/90" : "h-5 w-5 text-zinc-700"}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M2 12h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>

        <span className="min-w-[2ch]">{current.short}</span>

        {/* Chevron */}
        <svg
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""} ${
            isDark ? "text-white/80" : "text-zinc-600"
          }`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div role="menu" className={menuClass}>
          {options.map((opt) => {
            const isActive = opt.value === lang;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                onClick={() => {
                  setLang(opt.value);
                  setOpen(false);
                }}
                className={`${itemBase} ${isActive ? activeItem : ""}`}
              >
                <span className="font-medium">{opt.label}</span>
                {isActive ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6 9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className={isDark ? "text-white/60" : "text-zinc-400"}>{opt.short}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


