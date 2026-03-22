"use client";

import { useTranslation, SUPPORTED_LOCALES } from "@/lib/i18n";

export function LanguageSelector() {
  const { locale, setLocale } = useTranslation();
  return (
    <div className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-1 py-0.5">
      {SUPPORTED_LOCALES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
            locale === code
              ? "bg-pstudy-primary text-white"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
