"use client";

import { LanguageProvider } from "@/lib/i18n";
import { LanguageSelector } from "./LanguageSelector";
import { ToastProvider } from "./Toast";

function BannerWithLang() {
  return (
    <div className="flex items-center justify-center gap-3 bg-stone-100 px-4 py-2 text-center text-sm text-stone-600">
      <span>PSTUDY is in active development — features may change.</span>
      <LanguageSelector />
    </div>
  );
}

export function ClientProviders({
  children,
  showDevStrip = true,
}: {
  children: React.ReactNode;
  showDevStrip?: boolean;
}) {
  return (
    <LanguageProvider>
      <ToastProvider>
        {showDevStrip ? <BannerWithLang /> : null}
        {children}
      </ToastProvider>
    </LanguageProvider>
  );
}
