"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import en from "../../messages/en.json";
import de from "../../messages/de.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import it from "../../messages/it.json";

export type Locale = "en" | "de" | "es" | "fr" | "it";

const LOCALE_KEY = "pstudy-locale";

export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
  { code: "es", label: "ES" },
  { code: "fr", label: "FR" },
  { code: "it", label: "IT" },
];

const messages: Record<Locale, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  de: de as Record<string, unknown>,
  es: es as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  it: it as Record<string, unknown>,
};

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (
    key: string,
    params?: Record<string, string | number> & { count?: number }
  ) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    if (stored && codes.includes(stored)) {
      setLocaleState(stored);
    } else {
      const browser = navigator.language.slice(0, 2);
      if (codes.includes(browser as Locale)) setLocaleState(browser as Locale);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  const t = useCallback(
    (
      key: string,
      params?: Record<string, string | number> & { count?: number }
    ): string => {
      let lookupKey = key;
      if (params?.count !== undefined) {
        const pluralKey = key.replace(/(\w+)$/, "$1_plural");
        lookupKey = params.count === 1 ? key : pluralKey;
      }
      let msg = getNested(
        messages[locale] as Record<string, unknown>,
        lookupKey
      );
      if (!msg) {
        msg =
          getNested(messages.en as Record<string, unknown>, lookupKey) ?? key;
      }
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          msg = msg.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return msg;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: (k: string) => k,
    };
  }
  return ctx;
}
