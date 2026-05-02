"use client";

import { AppHeader, AppHeaderLink } from "@/components/AppHeader";
import { useTranslation } from "@/lib/i18n";

/** Header used on marketing-style pages (pricing, legal docs, signup, etc.). */
export function MarketingPublicHeader() {
  const { t } = useTranslation();
  return (
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
  );
}
