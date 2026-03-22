"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-stone-100">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo size="md" withText />
          <nav className="flex gap-4">
            <Link
              href="/login"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("home.logIn")}
            </Link>
            <a href="/dashboard" className="btn-primary cursor-pointer no-underline">
              {t("home.getStarted")}
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-stone-900 md:text-5xl">
          {t("home.title")}
        </h1>
        <p className="mb-10 text-lg text-stone-600">
          {t("home.subtitle")}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/dashboard"
            className="btn-primary cursor-pointer text-lg no-underline"
          >
            {t("home.openApp")}
          </a>
          <a
            href="/import"
            className="btn-secondary cursor-pointer text-lg no-underline"
          >
            {t("home.importTxt")}
          </a>
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
