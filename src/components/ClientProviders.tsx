"use client";

import { LanguageProvider } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "./LanguageSelector";
import { ToastProvider } from "./Toast";

function BannerWithLang() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-4 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
      <span>{t("banner.underConstruction")}</span>
      <LanguageSelector />
    </div>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <ToastProvider>
        <BannerWithLang />
        {children}
      </ToastProvider>
    </LanguageProvider>
  );
}
