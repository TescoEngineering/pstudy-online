"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";
import { getPrimaryCtaUrl } from "@/lib/cta-routing";

export default function HomePage() {
  const { t } = useTranslation();
  const primaryCtaHref = getPrimaryCtaUrl();
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-stone-100">
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

      <main className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-stone-900 md:text-5xl">
          Flashcards, exams, and peer-reviewed shared decks.
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-base font-normal text-stone-600 md:text-lg">
          Made in Europe, built for serious teachers and learners.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={primaryCtaHref}
            className="btn-primary cursor-pointer text-lg no-underline"
          >
            Join the private beta
          </Link>
          <Link
            href="/login"
            className="btn-secondary cursor-pointer text-lg no-underline"
          >
            {t("home.logIn")}
          </Link>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-sm text-stone-600">
          Free to start. €3.99/month for unlimited decks and AI generation. From €299/year for
          schools and language schools.{" "}
          <Link href="/pricing" className="font-medium text-pstudy-primary hover:underline">
            See full pricing →
          </Link>
        </p>

        <div className="mt-6 text-sm text-stone-500">
          🇪🇺 Made in Europe · GDPR-native · Hosted in the EU
        </div>

        <section className="mt-14">
          <div className="grid gap-4 md:grid-cols-3">
            <figure className="rounded-xl border border-stone-200 bg-white/60 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-xs font-medium text-stone-500">
                /public/screenshots/practice.png
              </div>
              <figcaption className="mt-2 text-sm text-stone-600">
                Practice with straight-answer mode
              </figcaption>
            </figure>
            <figure className="rounded-xl border border-stone-200 bg-white/60 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-xs font-medium text-stone-500">
                /public/screenshots/flashcard.png
              </div>
              <figcaption className="mt-2 text-sm text-stone-600">
                Flip flashcards on any device
              </figcaption>
            </figure>
            <figure className="rounded-xl border border-stone-200 bg-white/60 p-4">
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 text-xs font-medium text-stone-500">
                /public/screenshots/multiple-choice.png
              </div>
              <figcaption className="mt-2 text-sm text-stone-600">
                Multiple choice with images and maps
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mt-16 text-left">
          <h2 className="mb-6 text-2xl font-semibold text-stone-800">
            {t("home.features")}
          </h2>
          <ul className="grid gap-3 text-stone-700 md:grid-cols-2">
            <li>✓ Practice the way that fits your subject — type, flip, or pick</li>
            <li>✓ Speak your answers out loud — ideal for languages</li>
            <li>✓ Drill the cards you got wrong, in random order</li>
            <li>✓ Run real timed exams with shareable invite links</li>
            <li>✓ Bring your old decks across in one click</li>
            <li>✓ No installation — works on your laptop, tablet, or phone</li>
          </ul>

          <p className="mt-10 text-sm text-stone-600">{t("home.subtitle")}</p>
        </section>
      </main>
    </div>
  );
}
