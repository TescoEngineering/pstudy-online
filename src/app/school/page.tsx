"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";
import { useToast } from "@/components/Toast";
import { copyReadableDeckToMine } from "@/lib/supabase/decks";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";
import {
  fetchMyOrganizationMemberships,
  fetchSchoolSharedDecks,
  verifySchoolDeckShare,
  type OrganizationMembership,
  type SchoolDeckListRow,
} from "@/lib/supabase/organizations";
export default function SchoolLibraryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [rows, setRows] = useState<SchoolDeckListRow[]>([]);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<{ deckId: string; orgId: string } | null>(null);

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
      setLoading(true);
      try {
        const mems = await fetchMyOrganizationMemberships();
        setMemberships(mems);
        if (mems.length === 0) {
          setRows([]);
          return;
        }
        const data = await fetchSchoolSharedDecks();
        setRows(data);
      } catch (e) {
        console.error(e);
        toast.error(t("common.somethingWentWrong"));
      } finally {
        setLoading(false);
      }
    }
    void load();
    // Intentionally omit toast/t: showing a toast updates ToastProvider and would recreate
    // context value, retriggering this effect if toast were listed as a dependency.
  }, [router]);

  const myRoleByOrg = new Map(memberships.map((m) => [m.organizationId, m.role]));
  const canManageSchool = memberships.some((m) => m.role === "admin");

  async function handleCopy(deckId: string) {
    setCopyingId(deckId);
    try {
      const newDeck = await copyReadableDeckToMine(deckId);
      router.push(`/deck/${newDeck.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failedToCopyDeck"));
    } finally {
      setCopyingId(null);
    }
  }

  async function handleVerify(deckId: string, organizationId: string) {
    setVerifying({ deckId, orgId: organizationId });
    try {
      await verifySchoolDeckShare(deckId, organizationId);
      toast.success(t("school.verifySuccess"));
      const data = await fetchSchoolSharedDecks();
      setRows(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error(t("school.alreadyVerified"));
      } else {
        toast.error(err instanceof Error ? err.message : t("school.verifyFailed"));
      }
    } finally {
      setVerifying(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-stone-600">{t("common.loading")}</p>
        <HelpNavLink />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/dashboard">{t("dashboard.myDecks")}</AppHeaderLink>
            <AppHeaderLink href="/school" active>
              {t("dashboard.school")}
            </AppHeaderLink>
            {canManageSchool ? (
              <AppHeaderLink href="/school/admin">{t("school.manageSchool")}</AppHeaderLink>
            ) : null}
            <AppHeaderLink href="/community">{t("dashboard.community")}</AppHeaderLink>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
          </>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-2xl font-bold text-stone-900">{t("school.title")}</h1>
          <ContextHint>
            <p className="m-0">{t("school.browseHint")}</p>
          </ContextHint>
          {canManageSchool ? (
            <Link
              href="/school/admin"
              className="ml-auto shrink-0 text-sm font-medium text-pstudy-primary hover:underline"
            >
              {t("school.manageSchool")}
            </Link>
          ) : null}
        </div>

        {memberships.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p>{t("school.noMembership")}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p>{t("community.noSharedDecks")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const role = myRoleByOrg.get(row.organizationId);
              const canVerify =
                row.visibility === "school" &&
                !row.verifiedAt &&
                role &&
                (role === "teacher" || role === "admin");
              const verifyBusy =
                verifying?.deckId === row.deckId && verifying?.orgId === row.organizationId;

              return (
                <li
                  key={`${row.shareId}-${row.deckId}`}
                  className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-semibold text-stone-900">{row.deckTitle}</span>
                    <span className="ml-2 text-sm text-stone-500">· {row.organizationName}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.visibility === "school"
                            ? "bg-sky-100 text-sky-900"
                            : "bg-violet-100 text-violet-900"
                        }`}
                      >
                        {row.visibility === "school"
                          ? t("school.visibilitySchool")
                          : t("school.visibilityTeachersOnly")}
                      </span>
                      {row.visibility === "school" ? (
                        row.verifiedAt ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            {t("school.verifiedBadge")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            {t("school.pendingVerification")}
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/deck/${row.deckId}`} className="btn-secondary text-sm">
                      {t("school.openDeck")}
                    </Link>
                    <button
                      type="button"
                      className="btn-primary text-sm disabled:opacity-50"
                      disabled={copyingId === row.deckId}
                      onClick={() => void handleCopy(row.deckId)}
                    >
                      {copyingId === row.deckId ? t("community.copying") : t("school.copyToMyDecks")}
                    </button>
                    {canVerify ? (
                      <button
                        type="button"
                        className="btn-secondary text-sm disabled:opacity-50"
                        disabled={verifyBusy}
                        onClick={() => void handleVerify(row.deckId, row.organizationId)}
                      >
                        {verifyBusy ? t("common.loading") : t("school.verifyDeck")}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
