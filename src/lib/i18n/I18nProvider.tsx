"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MESSAGES, type Locale } from "./messages";

const STORAGE_KEY = "nunopi:locale";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<I18nValue | null>(null);

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ko" || stored === "ja" || stored === "en") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      const dict = MESSAGES[locale] ?? MESSAGES.ko;
      const s = dict[key] ?? MESSAGES.ko[key] ?? key;
      return interpolate(s, vars);
    },
    [locale],
  );

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  // Provider 밖에서도 깨지지 않게 ko 폴백.
  if (!ctx) {
    return {
      locale: "ko",
      setLocale: () => {},
      t: (key, vars) => interpolate(MESSAGES.ko[key] ?? key, vars),
    };
  }
  return ctx;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}

export function useT(): TFn {
  return useI18n().t;
}
