"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DICT,
  DEFAULT_LANG,
  loadDict,
  type Dict,
  type I18nKey,
  type Lang,
} from "@/app/i18n/dict";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: I18nKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Always start with DEFAULT_LANG (en) for every new session/access
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  // Only the default language is bundled up front; the others arrive here once
  // their chunk has loaded.
  const [dicts, setDicts] = useState<Partial<Record<Lang, Dict>>>({
    [DEFAULT_LANG]: DEFAULT_DICT,
  });

  useEffect(() => {
    // Clear any previously stored language to ensure next access is also default
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    // Sync with localStorage changes from other tabs/windows if user changes it
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const newLang = e.newValue as Lang;
        if (newLang === "vi" || newLang === "en" || newLang === "ko") {
          setLangState(newLang);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (dicts[lang]) return;
    loadDict(lang)
      .then((loaded) => {
        if (cancelled) return;
        setDicts((prev) => (prev[lang] ? prev : { ...prev, [lang]: loaded }));
      })
      .catch(() => {
        // Keep showing the default language if the chunk fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, [lang, dicts]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: I18nKey) => {
      return dicts[lang]?.[key] ?? DEFAULT_DICT[key] ?? key;
    },
    [dicts, lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Safe fallback so pages never crash if rendered outside I18nProvider
const _fallbackT = (key: I18nKey): string =>
  DEFAULT_DICT[key] ?? (key as string);
const _fallbackCtx: I18nContextValue = {
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: _fallbackT,
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  return ctx ?? _fallbackCtx;
}
