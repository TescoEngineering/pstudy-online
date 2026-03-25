"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<InboxItem[]>([]);

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

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Logo size="sm" withText />
          <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
            {t("result.backToDashboard")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-stone-900">{t("exam.myAssignedExams")}</h1>
        <p className="mb-6 text-stone-600">{t("exam.myAssignedExamsHint")}</p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <p className="text-stone-600">{t("common.loading")}</p>
          </div>
        ) : error ? (
          <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">{t("exam.noAssignedExams")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.inviteId} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-stone-900">{it.deckTitle}</p>
                  <p className="text-sm text-stone-500">
                    {it.examType === "multiple-choice" ? t("exam.typeMultipleChoice") : t("exam.typeStraightAnswer")}
                    {" · "}
                    {t("exam.durationLabel", { minutes: it.durationMinutes })}
                  </p>
                  <p className="text-xs text-stone-500">
                    {it.status === "not_started"
                      ? t("exam.statusNotStarted")
                      : it.status === "in_progress"
                        ? t("exam.statusInProgress")
                        : it.status === "expired"
                          ? t("exam.statusExpired")
                          : t("exam.statusSubmitted")}
                    {it.score ? ` · ${it.score.correct}/${it.score.total}` : ""}
                  </p>
                </div>
                {it.status === "submitted" ? (
                  <Link href={`/exam/take?token=${encodeURIComponent(it.token)}`} className="btn-secondary">
                    {t("exam.viewResult")}
                  </Link>
                ) : (
                  <Link href={`/exam/take?token=${encodeURIComponent(it.token)}`} className="btn-primary">
                    {it.status === "in_progress" ? t("exam.resumeExam") : t("exam.startExam")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

