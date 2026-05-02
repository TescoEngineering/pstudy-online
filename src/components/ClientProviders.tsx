"use client";

import { LanguageProvider } from "@/lib/i18n";
import { LanguageSelector } from "./LanguageSelector";
import { SiteFooter } from "./SiteFooter";
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
        <div className="flex min-h-screen flex-col">
          {showDevStrip ? <BannerWithLang /> : null}
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </div>
      </ToastProvider>
    </LanguageProvider>
  );
}
