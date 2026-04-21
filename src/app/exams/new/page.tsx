"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { fetchDeck, fetchDecks } from "@/lib/supabase/decks";
import { createExamAssignment } from "@/lib/supabase/exams";
import type { Deck } from "@/types/pstudy";
import {
  validateDeckForMcExam,
  validateDeckForStraightExam,
  type ExamType,
  type StraightGradingMode,
  type ExamPromptMode,
} from "@/lib/exam-validation";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";
import { useToast } from "@/components/Toast";
import { toError } from "@/lib/supabase/error-utils";

function NewExamForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const toast = useToast();
  const deckParam = searchParams.get("deck");

  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckId, setDeckId] = useState("");
  const [duration, setDuration] = useState(30);
  const [examType, setExamType] = useState<ExamType>("multiple-choice");
  const [gradingMode, setGradingMode] = useState<StraightGradingMode>("lenient-match");
  const [promptMode, setPromptMode] = useState<ExamPromptMode>("description");
  const [emails, setEmails] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullDeck, setFullDeck] = useState<Deck | null>(null);
  const [fullDeckLoading, setFullDeckLoading] = useState(false);

  const listRow = decks.find((d) => d.id === deckId) ?? null;
  const issues =
    fullDeck && fullDeck.items.length >= 2
      ? examType === "multiple-choice"
        ? validateDeckForMcExam(fullDeck, promptMode)
        : validateDeckForStraightExam(fullDeck, promptMode)
      : [];
  const twoOrMoreItems = fullDeck ? fullDeck.items.length >= 2 : false;
  const valid =
    !fullDeckLoading &&
    !!listRow &&
    fullDeck &&
    twoOrMoreItems &&
    issues.length === 0;

  useEffect(() => {
    const didLoadRef = { current: false };
    async function load() {
      if (didLoadRef.current) return;
      didLoadRef.current = true;
      const supabase = createClient();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login");
          return;
        }
      } catch (err) {
        // Supabase can throw transient auth-storage lock errors when effects run twice.
        // Treat this as "not authorized" and let the user log in again.
        router.replace("/login");
        return;
      }
      try {
        const list = await fetchDecks();
        setDecks(list);
        if (deckParam && list.some((d) => d.id === deckParam)) {
          setDeckId(deckParam);
        } else if (list.length > 0) {
          setDeckId(list[0].id);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, deckParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !deckId) return;
    setSaving(true);
    try {
      const { assignment } = await createExamAssignment(
        deckId,
        duration,
        promptMode,
        examType,
        gradingMode,
        emails
      );
      toast.success(t("exam.createdRedirect"));
      router.push(`/exams/${assignment.id}`);
    } catch (err) {
      const msg = toError(err).message;
      if (
        msg.includes("exam_assignments") ||
        msg.includes("schema cache") ||
        msg.includes("Could not find the table")
      ) {
        toast.error(t("exam.schemaMissing"));
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
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
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Logo size="sm" withText />
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/exams" className="text-stone-600 hover:text-pstudy-primary">
              ← {t("exam.myExams")}
            </Link>
            {deckId ? (
              <Link href={`/deck/${deckId}`} className="text-stone-600 hover:text-pstudy-primary">
                ← {t("exam.backToDeck")}
              </Link>
            ) : null}
            <HelpNavLink />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-2xl font-bold text-stone-900">{t("exam.newExam")}</h1>
          <ContextHint>
            <p className="m-0">{t("exam.subtitle")}</p>
          </ContextHint>
        </div>

        {decks.length === 0 ? (
          <div className="card text-stone-600">
            <p className="mb-4">{t("dashboard.noDecks")}</p>
            <Link href="/dashboard" className="btn-primary">
              {t("dashboard.newDeck")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                {t("exam.deck")}
              </label>
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.itemCount} {t("dashboard.items", { count: d.itemCount })})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                {t("exam.duration")}
              </label>
              <input
                type="number"
                min={5}
                max={24 * 60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                {t("exam.examType")}
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value as ExamType)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                <option value="multiple-choice">{t("exam.typeMultipleChoice")}</option>
                <option value="straight-answer">{t("exam.typeStraightAnswer")}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                {t("exam.promptMode")}
              </label>
              <select
                value={promptMode}
                onChange={(e) =>
                  setPromptMode(e.target.value as ExamPromptMode)
                }
                className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                <option value="description">{t("exam.promptDescription")}</option>
                <option value="explanation">{t("exam.promptExplanation")}</option>
              </select>
            </div>

            {examType === "straight-answer" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">
                  {t("exam.gradingMode")}
                </label>
                <select
                  value={gradingMode}
                  onChange={(e) => setGradingMode(e.target.value as StraightGradingMode)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                >
                  <option value="exact-match">{t("exam.gradingExact")}</option>
                  <option value="lenient-match">{t("exam.gradingLenient")}</option>
                </select>
              </div>
            )}

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <label htmlFor="exam-emails" className="text-sm font-medium text-stone-700">
                  {t("exam.examineeEmails")}
                </label>
                <ContextHint>
                  <p className="m-0 text-sm">{t("exam.emailsHint")}</p>
                </ContextHint>
              </div>
              <textarea
                id="exam-emails"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                placeholder="colleague@company.com"
              />
            </div>

            <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
              <p className="mb-2 text-sm font-medium text-stone-800">
                {t("exam.checkDeck")}
              </p>
              {!listRow ? null : fullDeckLoading ? (
                <p className="text-sm text-stone-600">{t("common.loading")}</p>
              ) : !fullDeck ? (
                <p className="text-sm text-red-600">{t("common.somethingWentWrong")}</p>
              ) : !twoOrMoreItems ? (
                <p className="text-sm text-red-600">{t("exam.needTwoItems")}</p>
              ) : issues.length === 0 ? (
                <p className="text-sm text-emerald-700">{t("exam.validationOk")}</p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-red-600">{t("exam.validationFail")}</p>
                  <ul className="list-inside list-disc text-sm text-stone-700">
                    {issues.map((i) => (
                      <li key={i.itemIndex}>
                        {t("exam.itemRow", { number: i.itemIndex + 1 })}:{" "}
                        {t(`exam.examValidation.${i.messageKey}`)}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={!valid || saving}
              className="btn-primary w-full disabled:opacity-50"
            >
              {saving ? t("common.loading") : t("exam.createExam")}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default function NewExamPage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
          <p className="text-stone-600">{t("common.loading")}</p>
          <HelpNavLink />
        </div>
      }
    >
      <NewExamForm />
    </Suspense>
  );
}
