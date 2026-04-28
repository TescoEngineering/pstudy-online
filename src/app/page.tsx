"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { ContextHint } from "@/components/ContextHint";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-stone-100">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
            <AppHeaderLink href="/login">{t("home.logIn")}</AppHeaderLink>
          </>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-stone-900 md:text-5xl">
          {t("home.title")}
        </h1>
        <div className="mb-10 flex justify-center">
          <ContextHint>
            <div className="space-y-3">
              <p className="m-0 text-base text-stone-700">{t("home.subtitle")}</p>
              <p className="m-0 text-sm text-stone-600">{t("home.trialPricingLine")}</p>
            </div>
          </ContextHint>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="btn-primary cursor-pointer text-lg no-underline"
          >
            {t("home.startFreeTrial")}
          </Link>
          <Link
            href="/login"
            className="btn-secondary cursor-pointer text-lg no-underline"
          >
            {t("home.logIn")}
          </Link>
        </div>

        <section className="mt-20 text-left">
          <h2 className="mb-6 text-2xl font-semibold text-stone-800">
            {t("home.features")}
          </h2>
          <ul className="grid gap-3 text-stone-600 md:grid-cols-2">
            <li>✓ {t("home.feature1")}</li>
            <li>✓ {t("home.feature2")}</li>
            <li>✓ {t("home.feature3")}</li>
            <li>✓ {t("home.feature4")}</li>
            <li>✓ {t("home.feature5")}</li>
            <li>✓ {t("home.feature6")}</li>
            <li>✓ {t("home.feature7")}</li>
            <li>✓ {t("home.feature8")}</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-500">
        {t("home.footerBrand")} ·{" "}
        <a
          href="https://www.pstudy.be"
          target="_blank"
          rel="noopener noreferrer"
          className="text-pstudy-primary hover:underline"
        >
          {t("home.website")}
        </a>
      </footer>
    </div>
  );
}
