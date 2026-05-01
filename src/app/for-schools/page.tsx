"use client";

import { useTranslation } from "@/lib/i18n";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

export default function ForSchoolsPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/pricing">Pricing</AppHeaderLink>
            <AppHeaderLink href="/for-schools">For Schools</AppHeaderLink>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
            <AppHeaderLink href="/login">{t("home.logIn")}</AppHeaderLink>
          </>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-bold text-stone-900">For Schools</h1>
        <p className="mt-3 text-stone-700">Coming soon.</p>
      </main>
    </div>
  );
}

