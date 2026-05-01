"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";
import { getPrimaryCtaUrl } from "@/lib/cta-routing";

export default function PricingPage() {
  const { t } = useTranslation();
  const primaryCtaHref = getPrimaryCtaUrl();
  const [annual, setAnnual] = useState(false);
  const personalPrice = annual ? "€35/year" : "€3.99/month";

  const faqs = useMemo(
    () => [
      {
        q: "What's an AI credit?",
        a: "One AI credit is one unit of AI generation capacity. Credits reset monthly on paid plans; top-ups never expire.",
      },
      {
        q: "What happens when paid plans launch?",
        a: "We'll give at least 30 days notice. Beta users get 6 months free, then a locked-in €3.99/month (or €35/year) price while their subscription stays active.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. You'll be able to cancel your subscription at any time once paid plans launch.",
      },
      {
        q: "Do you have a refund policy?",
        a: "We'll publish a clear refund policy before paid plans go live.",
      },
      {
        q: "Are my decks really exportable?",
        a: "Yes — your decks are always exportable.",
      },
    ],
    []
  );

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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-950">
          PSTUDY is in private beta — free for everyone, capped at 50 users. We expect to launch
          paid plans in Q3 2026 (July–September). When we do, beta users get 6 months free, then a
          locked-in price of €3.99/month (or €35/year) for as long as your subscription stays
          active. You'll receive at least 30 days notice before any change, and your decks are
          always exportable at any time.
        </div>

        <h1 className="mt-10 text-3xl font-bold text-stone-900">Pricing</h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-stone-700">Personal billing</span>
          <div className="inline-flex rounded-full border border-stone-200 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-3 py-1 font-medium ${
                !annual ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-3 py-1 font-medium ${
                annual ? "bg-stone-900 text-white" : "text-stone-700 hover:bg-stone-50"
              }`}
            >
              Annual <span className="text-stone-400">·</span> save €13/year
            </button>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Free</h2>
            <p className="mt-1 text-2xl font-bold text-stone-900">€0</p>
            <ul className="mt-4 space-y-2 text-sm text-stone-700">
              <li>3 decks</li>
              <li>100 cards total</li>
              <li>All practice modes</li>
              <li>No AI</li>
              <li>No exams</li>
            </ul>
            <Link href={primaryCtaHref} className="btn-primary mt-6 inline-block w-full text-center">
              Join the private beta
            </Link>
          </div>

          <div className="rounded-2xl border border-teal-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Personal</h2>
            <p className="mt-1 text-2xl font-bold text-stone-900">{personalPrice}</p>
            <ul className="mt-4 space-y-2 text-sm text-stone-700">
              <li>Unlimited decks</li>
              <li>AI generation (500 credits/month)</li>
              <li>All practice modes</li>
              <li>Share to PstudyCommunity</li>
              <li>Top-ups available</li>
            </ul>
            <Link href={primaryCtaHref} className="btn-primary mt-6 inline-block w-full text-center">
              Join the private beta
            </Link>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-stone-900">Community</h2>
            <p className="mt-1 text-2xl font-bold text-stone-900">From €299/year</p>
            <ul className="mt-4 space-y-2 text-sm text-stone-700">
              <li>For schools and training orgs</li>
              <li>MyCommunities</li>
              <li>Exams</li>
              <li>Peer review</li>
              <li>Admin dashboard</li>
              <li>GDPR DPA</li>
              <li>500 AI credits per seat/month (pooled)</li>
            </ul>
            <a
              href="mailto:hello@pstudy.be"
              className="btn-secondary mt-6 inline-block w-full text-center"
            >
              Contact us for schools
            </a>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-stone-900">Community sub-tiers</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-sm font-semibold text-stone-900">Starter</div>
              <div className="mt-1 text-sm text-stone-700">Up to 25 seats</div>
              <div className="mt-3 text-lg font-bold text-stone-900">€299/year</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-sm font-semibold text-stone-900">Standard</div>
              <div className="mt-1 text-sm text-stone-700">Up to 100 seats</div>
              <div className="mt-3 text-lg font-bold text-stone-900">€699/year</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-sm font-semibold text-stone-900">Enterprise</div>
              <div className="mt-1 text-sm text-stone-700">100+ seats</div>
              <div className="mt-3 text-lg font-bold text-stone-900">Quote</div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-stone-900">Top-ups</h2>
          <p className="mt-3 text-stone-700">
            Run out of AI credits? Add more anytime: €3 / 250 credits, €5 / 500 credits, €9 / 1,000
            credits. No expiration. Available on Personal and Community plans.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-stone-900">FAQ</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-xl border border-stone-200 bg-white px-5 py-4">
                <summary className="cursor-pointer select-none font-medium text-stone-900">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-stone-700">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

