"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import {
  fetchExamAssignmentDetail,
  addInvitesToAssignment,
  type ExamInviteRow,
} from "@/lib/supabase/exams";
import { Logo } from "@/components/Logo";
import { useToast } from "@/components/Toast";

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { t } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignment, setAssignment] = useState<{
    duration_minutes: number;
    prompt_mode: string;
    exam_type: string;
    grading_mode: string;
  } | null>(null);
  const [deckTitle, setDeckTitle] = useState("");
  const [deckId, setDeckId] = useState("");
  const [invites, setInvites] = useState<ExamInviteRow[]>([]);
  const [moreEmails, setMoreEmails] = useState("");
  const [adding, setAdding] = useState(false);
  const [origin, setOrigin] = useState("");
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState("");
  const [examBusy, setExamBusy] = useState(false);
  const [results, setResults] = useState<
    Array<{
      inviteId: string;
      email: string;
      status: "not_started" | "in_progress" | "submitted" | "expired";
      startedAt?: string;
      submittedAt?: string | null;
      score?: { correct: number; wrong: number; total: number };
      details?: Array<{ instruction: string; prompt: string; expected: string; given: string; isCorrect: boolean }>;
    }>
  >([]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    try {
      const data = await fetchExamAssignmentDetail(id);
      if (!data) {
        setError("Not found");
        return;
      }
      setAssignment(data.assignment);
      setDeckTitle(data.deck.title);
      setDeckId(data.deck.id);
      setInvites(data.invites);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("exam_assignments") || msg.includes("schema cache")) {
        setError(t("exam.schemaMissing"));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadResults = useCallback(async () => {
    try {
      setResultsLoading(true);
      setResultsError("");
      const res = await fetch(
        `/api/exam/results?assignmentId=${encodeURIComponent(id)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load results");
      setResults(data.results ?? []);
    } catch (err) {
      setResultsError(
        err instanceof Error ? err.message : t("common.somethingWentWrong")
      );
    } finally {
      setResultsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void reloadResults();
  }, [reloadResults]);

  async function handleReissue(inviteEmail: string) {
    if (!inviteEmail) return;
    setExamBusy(true);
    try {
      const res = await fetch(`/api/exam/invites/reissue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: id, email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reissue failed");
      toast.success(t("exam.reissueOk"));
      await load();
      await reloadResults();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setExamBusy(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!inviteId) return;
    if (!window.confirm(t("exam.revokeConfirm"))) return;
    setExamBusy(true);
    try {
      const res = await fetch(`/api/exam/invites/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: id, inviteId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Revoke failed");
      toast.success(t("exam.revokeOk"));
      await load();
      await reloadResults();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setExamBusy(false);
    }
  }

  function handleExportCsv() {
    const url = `/api/exam/results/export?assignmentId=${encodeURIComponent(id)}`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `exam-${id}-results.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success(t("exam.exportStarted"));
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/exam/take?token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(url);
    toast.success(t("exam.linkCopied"));
  }

  async function handleAddInvites(e: React.FormEvent) {
    e.preventDefault();
    if (!moreEmails.trim()) return;
    setAdding(true);
    try {
      const added = await addInvitesToAssignment(id, moreEmails);
      setInvites((prev) => [...prev, ...added]);
      setMoreEmails("");
      toast.success(t("exam.addInvitesSubmit"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("That email is already invited for this exam.");
      } else {
        toast.error(msg);
      }
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-600">{t("common.loading")}</p>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-16 text-center">
        <p className="text-red-600">{error || "—"}</p>
        <Link href="/exams" className="mt-4 inline-block text-pstudy-primary hover:underline">
          ← {t("exam.myExams")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo size="sm" withText />
          <Link href="/exams" className="text-stone-600 hover:text-pstudy-primary">
            ← {t("exam.myExams")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-stone-900">{deckTitle}</h1>
        <p className="mb-6 text-stone-600">
          {t("exam.durationLabel", { minutes: assignment.duration_minutes })} ·{" "}
          {assignment.exam_type === "multiple-choice"
            ? t("exam.typeMultipleChoice")
            : `${t("exam.typeStraightAnswer")} (${assignment.grading_mode === "exact-match" ? t("exam.gradingExact") : t("exam.gradingLenient")})`} ·{" "}
          {assignment.prompt_mode === "description"
            ? t("exam.promptDescription")
            : t("exam.promptExplanation")}
        </p>

        <div className="mb-6 flex flex-wrap gap-3">
          <Link href={`/deck/${deckId}`} className="btn-secondary text-sm">
            {t("exam.openDeck")}
          </Link>
        </div>

        <div className="mb-4 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="mb-2 font-semibold text-stone-900">{t("exam.inviteLinks")}</h2>
          <p className="mb-4 text-sm text-stone-600">{t("exam.inviteHelp")}</p>
          <ul className="space-y-3">
            {invites.map((inv) => (
              (() => {
                const r = results.find((x) => x.inviteId === inv.id);
                const status = r?.status ?? "not_started";
                const reissuable = status !== "in_progress";
                return (
              <li
                key={inv.id}
                className="flex flex-col gap-3 rounded-lg border border-stone-100 bg-stone-50 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-stone-800">{inv.email}</span>
                  <p className="mt-1 text-xs text-stone-500">
                    {t("exam.statusLabel")}{" "}
                    <span className="text-stone-700">
                      {status === "not_started"
                        ? t("exam.statusNotStarted")
                        : status === "in_progress"
                          ? t("exam.statusInProgress")
                          : status === "expired"
                            ? t("exam.statusExpired")
                            : t("exam.statusSubmitted")}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-stretch">
                  <button
                    type="button"
                    onClick={() => copyLink(inv.access_token)}
                    className="btn-primary text-sm"
                  >
                    {t("exam.copyLink")}
                  </button>
                  <details className="relative min-w-[10rem] [&_summary::-webkit-details-marker]:hidden">
                    <summary className="btn-secondary cursor-pointer list-none rounded-lg border border-stone-300 px-3 py-2 text-center text-sm">
                      {t("exam.moreOptions")}
                    </summary>
                    <div className="absolute right-0 z-10 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-stone-200 bg-white py-1 shadow-md">
                      <a
                        href={
                          origin
                            ? `mailto:${inv.email}?subject=${encodeURIComponent(
                                `PSTUDY exam: ${deckTitle}`
                              )}&body=${encodeURIComponent(
                                `Hi,\n\nYou have been invited to take an exam.\n\nOpen this link:\n${origin}/exam/take?token=${inv.access_token}\n\nGood luck!`
                              )}`
                            : `mailto:${inv.email}`
                        }
                        className="block px-3 py-2 text-sm text-stone-800 hover:bg-stone-50"
                      >
                        {t("exam.emailWithLink")}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleReissue(inv.email)}
                        disabled={examBusy || !reissuable}
                        title={
                          !reissuable ? t("exam.reissueDisabledInProgress") : undefined
                        }
                        className="block w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t("exam.reissueInvite")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(inv.id)}
                        disabled={examBusy}
                        className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {t("exam.cancelInvite")}
                      </button>
                    </div>
                  </details>
                </div>
              </li>
                );
              })()
            ))}
          </ul>
        </div>

        <form onSubmit={handleAddInvites} className="card space-y-3">
          <h2 className="font-semibold text-stone-900">{t("exam.addInvites")}</h2>
          <p className="text-sm text-stone-600">{t("exam.addInvitesPlaceholder")}</p>
          <textarea
            value={moreEmails}
            onChange={(e) => setMoreEmails(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          />
          <button type="submit" disabled={adding || !moreEmails.trim()} className="btn-primary">
            {adding ? t("common.loading") : t("exam.addInvitesSubmit")}
          </button>
        </form>

        <div className="mt-6 card space-y-3">
          <h2 className="text-lg font-semibold text-stone-900">{t("exam.resultsTitle")}</h2>
          <button
            type="button"
            onClick={handleExportCsv}
            className="btn-secondary text-sm"
            disabled={examBusy}
          >
            {t("exam.exportCsv")}
          </button>
          {resultsLoading ? (
            <p className="text-stone-600">{t("common.loading")}</p>
          ) : resultsError ? (
            <p className="text-red-600">{resultsError}</p>
          ) : results.length === 0 ? (
            <p className="text-stone-600">{t("exam.noResultsYet")}</p>
          ) : (
            <div className="space-y-3">
              {results.map((r) => (
                <details key={r.inviteId} className="rounded-lg border border-stone-200 bg-white p-3">
                  <summary className="cursor-pointer select-none text-sm font-medium text-stone-800">
                    {r.email} ·{" "}
                    {r.status === "not_started"
                      ? t("exam.statusNotStarted")
                      : r.status === "in_progress"
                        ? t("exam.statusInProgress")
                        : r.status === "expired"
                          ? t("exam.statusExpired")
                          : t("exam.statusSubmitted")}
                    {r.score
                      ? ` · ${r.score.correct}/${r.score.total} (${Math.round((r.score.correct / Math.max(1, r.score.total)) * 100)}%)`
                      : ""}
                  </summary>
                  {r.details && (
                    <ul className="mt-3 max-h-96 space-y-2 overflow-auto text-sm">
                      {r.details.map((d, idx) => (
                        <li key={idx} className="rounded border border-stone-100 bg-stone-50 p-2">
                          <p className={d.isCorrect ? "text-emerald-700" : "text-red-700"}>
                            {d.isCorrect ? "✓" : "✕"} {d.instruction || d.prompt || "—"}
                          </p>
                          {d.instruction && d.prompt ? (
                            <p className="text-stone-700">{d.prompt}</p>
                          ) : null}
                          <p className="text-stone-600">{t("exam.givenAnswer")}: {d.given || "—"}</p>
                          {!d.isCorrect ? (
                            <p className="text-stone-600">{t("exam.expectedAnswer")}: {d.expected}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
