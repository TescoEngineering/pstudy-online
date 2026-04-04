"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import {
  fetchMyExamAssignments,
  deleteExamAssignment,
  type ExamAssignmentSummary,
} from "@/lib/supabase/exams";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/Toast";

export default function ExamsListPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState<ExamAssignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExamAssignmentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        const data = await fetchMyExamAssignments();
        setRows(data);
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
    }
    load();
  }, [router, t]);

  async function confirmDeleteExam() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteExamAssignment(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success(t("exam.deleteExamSuccess"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("common.somethingWentWrong")
      );
    } finally {
      setDeleting(false);
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
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Logo size="sm" withText />
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
              {t("result.backToDashboard")}
            </Link>
            <Link href="/help" className="text-stone-600 hover:text-pstudy-primary">
              {t("help.nav")}
            </Link>
            <Link href="/exams/new" className="btn-primary text-sm">
              {t("exam.newExam")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-2xl font-bold text-stone-900">{t("exam.title")}</h1>
          <ContextHint>
            <p className="m-0">{t("exam.subtitle")}</p>
          </ContextHint>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {error}
          </div>
        )}

        {rows.length === 0 && !error ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">{t("exam.noExamsYet")}</p>
            <Link href="/exams/new" className="btn-primary inline-block">
              {t("exam.newExam")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <Link
                    href={`/exams/${r.id}`}
                    className="font-semibold text-pstudy-primary hover:underline"
                  >
                    {r.deck.title}
                  </Link>
                  <p className="text-sm text-stone-500">
                    {t("exam.durationLabel", { minutes: r.duration_minutes })} ·{" "}
                    {r.exam_type === "multiple-choice"
                      ? t("exam.typeMultipleChoice")
                      : `${t("exam.typeStraightAnswer")} (${r.grading_mode === "exact-match" ? t("exam.gradingExact") : t("exam.gradingLenient")})`} ·{" "}
                    {t("exam.invites")}: {r.invite_count} · {t("exam.items", { count: r.deck.items.length })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/exams/${r.id}`} className="btn-secondary text-sm">
                    {t("exam.details")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(r)}
                    disabled={deleting}
                    className="text-sm font-medium text-red-600 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {t("exam.deleteExam")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteExam()}
        title={t("exam.deleteExamTitle")}
        message={t("exam.deleteExamMessage")}
        confirmLabel={t("exam.deleteExam")}
        variant="danger"
      />
    </div>
  );
}
