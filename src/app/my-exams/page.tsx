"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

type InboxItem = {
  inviteId: string;
  assignmentId: string;
  token: string;
  deckTitle: string;
  examType: "multiple-choice" | "straight-answer";
  gradingMode: "exact-match" | "lenient-match";
  promptMode: "description" | "explanation";
  durationMinutes: number;
  status: "in_progress" | "submitted" | "expired" | "not_started";
  startedAt?: string;
  expiresAt?: string;
  submittedAt?: string | null;
  score: { correct: number; wrong: number; total: number } | null;
};

export default function MyExamsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [removeTargetId, setRemoveTargetId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

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
        const res = await fetch("/api/exam/inbox");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load exam inbox");
        setItems((data.items ?? []) as InboxItem[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
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

  async function confirmRemoveFromList() {
    const inviteId = removeTargetId;
    if (!inviteId || removing) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/exam/inbox/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("common.somethingWentWrong"));
      setItems((prev) => prev.filter((it) => it.inviteId !== inviteId));
      toast.success(t("exam.deleteAssignedExamSuccess"));
      setRemoveTargetId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setRemoving(false);
    }
  }

  function examStatusLabel(it: InboxItem): string {
    if (it.status === "not_started") return t("exam.statusNotStarted");
    if (it.status === "in_progress") return t("exam.statusInProgress");
    if (it.status === "expired") return t("exam.statusExpired");
    return t("exam.statusSubmitted");
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4">
          <div className="shrink-0">
            <Logo size="sm" withText />
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:justify-end">
            <Link href="/community" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.community")}
            </Link>
            <Link
              href="/my-exams"
              className="font-medium text-pstudy-primary"
              aria-current="page"
            >
              {t("exam.myAssignedExams")}
            </Link>
            <Link href="/import" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.importTxt")}
            </Link>
            <Link href="/exams" className="text-stone-600 hover:text-pstudy-primary">
              {t("exam.title")}
            </Link>
            <Link href="/help" className="text-stone-600 hover:text-pstudy-primary">
              {t("help.nav")}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-stone-500 hover:text-stone-700"
            >
              {t("dashboard.signOut")}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900">{t("exam.myAssignedExams")}</h1>
          <p className="mt-2 text-stone-600">{t("exam.myAssignedExamsHint")}</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-stone-600">{t("common.loading")}</p>
          </div>
        ) : error ? (
          <p className="mb-4 text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">{t("exam.noAssignedExams")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li
                key={it.inviteId}
                className="card flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/exam/take?token=${encodeURIComponent(it.token)}`}
                    className="font-semibold text-pstudy-primary hover:underline"
                  >
                    {it.deckTitle}
                  </Link>
                  <p className="text-sm text-stone-500">
                    {it.examType === "multiple-choice"
                      ? t("exam.typeMultipleChoice")
                      : t("exam.typeStraightAnswer")}
                    {" · "}
                    {t("exam.durationLabel", { minutes: it.durationMinutes })}
                    {" · "}
                    {examStatusLabel(it)}
                    {it.score ? ` · ${it.score.correct}/${it.score.total}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {it.status === "submitted" ? (
                    <Link
                      href={`/exam/take?token=${encodeURIComponent(it.token)}`}
                      className="btn-secondary text-sm whitespace-nowrap"
                    >
                      {t("exam.viewResult")}
                    </Link>
                  ) : (
                    <Link
                      href={`/exam/take?token=${encodeURIComponent(it.token)}`}
                      className="btn-primary text-sm whitespace-nowrap"
                    >
                      {it.status === "in_progress" ? t("exam.resumeExam") : t("exam.startExam")}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setRemoveTargetId(it.inviteId)}
                    disabled={removing}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmModal
        open={removeTargetId !== null}
        onClose={() => !removing && setRemoveTargetId(null)}
        onConfirm={() => void confirmRemoveFromList()}
        title={t("exam.deleteAssignedExamTitle")}
        message={t("exam.deleteAssignedExamMessage")}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}

