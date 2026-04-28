"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";
import { ContextHint } from "@/components/ContextHint";
import type { AccountOverviewPayload } from "@/lib/account-overview";
import type { OrganizationRole } from "@/types/organization";

function communityRoleLabel(role: OrganizationRole, t: (key: string) => string) {
  const k: Record<OrganizationRole, string> = {
    student: "school.roleStudent",
    teacher: "school.roleTeacher",
    admin: "school.roleAdmin",
  };
  return t(k[role]);
}

function StatCard({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pstudy-primary/80 via-teal-400/70 to-emerald-500/60" />
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
        {hint ? (
          <ContextHint>
            <p className="m-0 text-xs font-normal normal-case tracking-normal leading-relaxed text-stone-600">
              {hint}
            </p>
          </ContextHint>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BigNum({ value, sub }: { value: number; sub?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
      <span className="text-4xl font-bold tabular-nums text-stone-900">{value}</span>
      {sub ? <span className="text-sm font-medium text-stone-500">{sub}</span> : null}
    </div>
  );
}

function SubStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-stone-50/90 px-4 py-3">
      <span className="text-sm text-stone-600">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-stone-900">{value}</span>
    </div>
  );
}

export default function AccountPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<AccountOverviewPayload | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const res = await fetch("/api/account/overview");
        const json = (await res.json()) as AccountOverviewPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || t("account.loadError"));
        setData(json as AccountOverviewPayload);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("account.loadError"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, t]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-stone-600">{t("common.loading")}</p>
        <HelpNavLink />
      </div>
    );
  }

  const sharedTotal =
    data ? data.decks.sharedDraft + data.decks.sharedChecked + (data.decks.sharedVerified ?? 0) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100/90 via-stone-50 to-stone-100/80">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/dashboard">{t("dashboard.myDecks")}</AppHeaderLink>
            <AppHeaderLink href="/import">{t("dashboard.importTxt")}</AppHeaderLink>
            <AppHeaderLink href="/my-exams">{t("exam.title")}</AppHeaderLink>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
            <AppHeaderLink href="/account" active>
              {t("dashboard.navAccount")}
            </AppHeaderLink>
            <button type="button" onClick={handleSignOut} className="text-stone-500 hover:text-stone-700">
              {t("dashboard.signOut")}
            </button>
          </>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-stone-900">{t("account.pageTitle")}</h1>
          <p className="mt-2 text-stone-600">{t("account.subtitle")}</p>
          {data?.email ? (
            <p className="mt-4 rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
              <span className="text-sm text-stone-500">{t("account.emailLabel")}</span>
              <span className="ml-2 font-medium text-stone-900">{data.email}</span>
              {data.memberSince ? (
                <span className="mt-2 block text-sm text-stone-500">
                  {t("account.memberSince")}{" "}
                  <time dateTime={data.memberSince}>
                    {new Date(data.memberSince).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">{error}</p>
        ) : null}

        {data ? (
          <div className="grid gap-6 md:grid-cols-2">
            <StatCard
              title={t("account.sectionDecks")}
              hint={t("account.decksSharedHint")}
              className="md:col-span-1"
            >
              <BigNum value={data.decks.total} />
              <div className="mt-5 space-y-2">
                <SubStat label={t("account.decksPrivate")} value={data.decks.private} />
                <SubStat label={t("account.decksSharedDraft")} value={data.decks.sharedDraft} />
                <SubStat label={t("account.decksSharedChecked")} value={data.decks.sharedChecked} />
                {typeof data.decks.sharedVerified === "number" ? (
                  <SubStat label={t("account.decksSharedVerified")} value={data.decks.sharedVerified} />
                ) : null}
              </div>
            </StatCard>

            <StatCard title={t("account.itemsTotal")} hint={t("account.itemsTotalHint")}>
              <BigNum value={data.itemsTotal} />
            </StatCard>

            <StatCard title={t("account.sectionCommunity")} hint={t("account.communitySharedHint")}>
              <BigNum value={sharedTotal} />
            </StatCard>

            <StatCard
              title={t("account.sectionCommunities")}
              hint={t("account.communitiesHint")}
              className="md:col-span-2"
            >
              {data.communities.length === 0 ? (
                <p className="m-0 text-sm leading-relaxed text-stone-600">
                  {t("account.communitiesEmpty")}
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {data.communities.map((c) => (
                    <li
                      key={c.organizationId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50/90 px-4 py-3"
                    >
                      <span className="font-medium text-stone-900">{c.name}</span>
                      <span className="text-sm text-stone-600">
                        {communityRoleLabel(c.role, t)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {data.communities.length > 0 ? (
                <p className="mb-0 mt-4 text-sm">
                  <Link href="/school" className="font-medium text-pstudy-primary hover:underline">
                    {t("account.linkCommunities")}
                  </Link>
                </p>
              ) : null}
            </StatCard>

            <StatCard title={t("account.sectionExams")}>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-stone-600">{t("account.examsIssued")}</p>
                    <ContextHint>
                      <p className="m-0 text-xs text-stone-600">{t("account.examsIssuedHint")}</p>
                    </ContextHint>
                  </div>
                  <BigNum value={data.examsIssued} />
                </div>
                <div className="border-t border-stone-100 pt-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-stone-600">{t("account.examsToTake")}</p>
                    <ContextHint>
                      <p className="m-0 text-xs text-stone-600">{t("account.examsToTakeHint")}</p>
                    </ContextHint>
                  </div>
                  <BigNum value={data.examsToTake} />
                </div>
              </div>
            </StatCard>

            <StatCard title={t("account.sectionAi")} className="md:col-span-2">
              <p className="text-sm leading-relaxed text-stone-700">
                {data.aiCreditsHint
                  ? t("account.aiCreditsFromHost", { hint: data.aiCreditsHint })
                  : t("account.aiCreditsDefault")}
              </p>
            </StatCard>

            <div className="md:col-span-2">
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  {t("account.quickLinks")}
                </h2>
                <ul className="mt-4 flex flex-wrap gap-3">
                  <li>
                    <Link href="/dashboard" className="btn-secondary text-sm">
                      {t("account.linkMyDecks")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/import" className="btn-secondary text-sm">
                      {t("account.linkImport")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/exams" className="btn-secondary text-sm">
                      {t("account.linkExams")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/my-exams" className="btn-secondary text-sm">
                      {t("account.linkAssigned")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/school" className="btn-secondary text-sm">
                      {t("account.linkCommunities")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/community" className="btn-secondary text-sm">
                      {t("account.linkCommunity")}
                    </Link>
                  </li>
                  <li>
                    <Link href="/help" className="btn-secondary text-sm">
                      {t("account.linkHelp")}
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
