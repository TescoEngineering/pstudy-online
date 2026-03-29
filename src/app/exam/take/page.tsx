"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";

type ApiAttempt = {
  id: string;
  status: "in_progress" | "submitted" | "expired";
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  currentIndex: number;
  answers: Array<{ answer: string }>;
  correctCount: number;
  wrongCount: number;
};

type ApiQuestion = {
  itemId: string;
  instruction: string;
  prompt: string;
  pictureUrl?: string;
  options?: string[];
};

function ExamTakeInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const storageKey = useMemo(() => (token ? `pstudy-exam-${token}` : ""), [token]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deckTitle, setDeckTitle] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [examType, setExamType] = useState<"multiple-choice" | "straight-answer">("multiple-choice");
  const [gradingMode, setGradingMode] = useState<"exact-match" | "lenient-match">("lenient-match");
  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [attempt, setAttempt] = useState<ApiAttempt | null>(null);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Array<{ answer: string }>>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{
    total: number;
    correct: number;
    wrong: number;
    details: Array<{ prompt: string; expected: string; given: string; isCorrect: boolean }>;
  } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const current = questions[index];

  useEffect(() => {
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/exam/take?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load exam");
        setDeckTitle(data.deckTitle);
        setInviteEmail(data.inviteEmail);
        setDurationMinutes(data.durationMinutes);
        setExamType(data.examType);
        setGradingMode(data.gradingMode);
        setQuestions(data.questions ?? []);
        if (data.attempt) {
          setAttempt(data.attempt);
          setStarted(data.attempt.status === "in_progress");
          setIndex(Math.max(0, data.attempt.currentIndex || 0));
          const apiAnswers =
            (data.attempt.answers as Array<{ answer: string }> | undefined) ??
            (data.questions as ApiQuestion[]).map(() => ({ answer: "" }));
          const localRaw = storageKey ? localStorage.getItem(storageKey) : null;
          const local =
            localRaw ? (JSON.parse(localRaw) as { answers?: Array<{ answer: string }>; index?: number }) : null;
          const mergedAnswers =
            local?.answers && Array.isArray(local.answers) && local.answers.length === apiAnswers.length
              ? local.answers
              : apiAnswers;
          setAnswers(mergedAnswers);
          const localIndex =
            typeof local?.index === "number" ? Math.max(0, Math.min(local.index, mergedAnswers.length - 1)) : null;
          if (localIndex !== null && data.attempt.status === "in_progress") {
            setIndex(localIndex);
          }
          if (data.attempt.status === "submitted") {
            setResult({
              total: data.questions.length,
              correct: data.attempt.correctCount,
              wrong: data.attempt.wrongCount,
              details: [],
            });
          }
        } else {
          const localRaw = storageKey ? localStorage.getItem(storageKey) : null;
          const local =
            localRaw ? (JSON.parse(localRaw) as { answers?: Array<{ answer: string }>; index?: number }) : null;
          const blank = (data.questions as ApiQuestion[]).map(() => ({ answer: "" }));
          const localAnswers =
            local?.answers && Array.isArray(local.answers) && local.answers.length === blank.length
              ? local.answers
              : blank;
          setAnswers(localAnswers);
          if (local?.index && typeof local.index === "number") {
            setIndex(Math.max(0, Math.min(local.index, localAnswers.length - 1)));
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.somethingWentWrong"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, t, storageKey]);

  const remainingSeconds = useMemo(() => {
    if (!attempt || attempt.status !== "in_progress") return durationMinutes * 60;
    return Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - nowMs) / 1000));
  }, [attempt, durationMinutes, nowMs]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    function beforeUnloadHandler(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnloadHandler);
    const timer = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      const left = Math.floor((new Date(attempt.expiresAt).getTime() - current) / 1000);
      if (left <= 0) {
        clearInterval(timer);
        void handleSubmit();
      }
    }, 1000);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      clearInterval(timer);
    };
  }, [attempt]);

  async function startExam() {
    if (!token) return;
    if (!confirm("Start exam now?")) return;
    try {
      const res = await fetch("/api/exam/take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "start" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start exam");
      setAttempt(data.attempt);
      setStarted(true);
      const blank = questions.map(() => ({ answer: "" }));
      const localRaw = storageKey ? localStorage.getItem(storageKey) : null;
      const local =
        localRaw ? (JSON.parse(localRaw) as { answers?: Array<{ answer: string }>; index?: number }) : null;
      const localAnswers =
        local?.answers && Array.isArray(local.answers) && local.answers.length === blank.length
          ? local.answers
          : blank;
      setAnswers(localAnswers);
      setIndex(typeof local?.index === "number" ? local.index : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    }
  }

  async function saveProgress(nextAnswers: Array<{ answer: string }>, nextIndex: number) {
    if (!token || !started || !attempt) return;
    if (storageKey) {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ answers: nextAnswers, index: nextIndex, updatedAt: Date.now() })
      );
    }
    await fetch("/api/exam/take", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action: "save",
        answers: nextAnswers,
        currentIndex: nextIndex,
      }),
    });
  }

  async function handleSubmit() {
    if (!token || !attempt || submitting) return;
    if (!confirm("Submit exam? You won't be able to change answers afterwards.")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/exam/take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: "submit",
          answers,
          currentIndex: questions.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setAttempt(data.attempt);
      setResult(data.result);
      setStarted(false);
      if (storageKey) localStorage.removeItem(storageKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Logo size="sm" withText />
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/" className="text-stone-600 hover:text-pstudy-primary">
              {t("login.backToHome")}
            </Link>
            <HelpNavLink />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-xl font-bold text-stone-900">{t("exam.takeTitle")}</h1>
        {!token ? (
          <p className="text-stone-600">{t("common.somethingWentWrong")}</p>
        ) : loading ? (
          <p className="text-stone-600">{t("common.loading")}</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : result ? (
          <div className="card space-y-3 text-left">
            <p className="text-stone-700">
              {deckTitle} · {inviteEmail}
            </p>
            <p className="text-lg font-semibold text-stone-900">
              {result.correct}/{result.total} ({Math.round((result.correct / Math.max(1, result.total)) * 100)}%)
            </p>
            {result.details.length > 0 && (
              <ul className="max-h-[420px] space-y-2 overflow-auto">
                {result.details.map((d, i) => (
                  <li key={i} className="rounded border border-stone-200 p-2 text-sm">
                    <p className={d.isCorrect ? "text-emerald-700" : "text-red-700"}>
                      {d.isCorrect ? "✓" : "✕"} {d.prompt}
                    </p>
                    <p className="text-stone-600">Your answer: {d.given || "—"}</p>
                    {!d.isCorrect && <p className="text-stone-600">Expected: {d.expected}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : !started ? (
          <div className="card space-y-3 text-left">
            <p className="text-stone-700">{deckTitle}</p>
            <p className="text-sm text-stone-600">{inviteEmail}</p>
            <p className="text-sm text-stone-600">
              {durationMinutes} min ·{" "}
              {examType === "multiple-choice" ? t("exam.typeMultipleChoice") : t("exam.typeStraightAnswer")}
              {examType === "straight-answer" &&
                ` (${gradingMode === "exact-match" ? t("exam.gradingExact") : t("exam.gradingLenient")})`}
            </p>
            <button onClick={startExam} className="btn-primary">
              {attempt?.status === "in_progress" ? t("exam.resumeExam") : t("exam.startExam")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="card">
              <div className="mb-2 flex items-center justify-between text-sm text-stone-600">
                <span>
                  {index + 1} / {questions.length}
                </span>
                <span>
                  {t("exam.timeLeft")}{" "}
                  {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
                </span>
              </div>
              {current?.instruction ? (
                <p className="mb-2 text-sm text-stone-500">{current.instruction}</p>
              ) : null}
              <h2 className="text-lg font-semibold text-stone-900">{current?.prompt}</h2>
              {current?.pictureUrl ? (
                <div className="mt-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.pictureUrl}
                    alt="Question"
                    className="max-h-64 w-full rounded-lg object-contain ring-1 ring-stone-200"
                  />
                </div>
              ) : null}
            </div>

            <div className="card">
              {examType === "multiple-choice" ? (
                <div className="space-y-2">
                  {(current?.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const next = [...answers];
                        next[index] = { answer: opt };
                        setAnswers(next);
                        void saveProgress(next, index);
                      }}
                      className={`w-full rounded border px-3 py-2 text-left ${
                        answers[index]?.answer === opt
                          ? "border-pstudy-primary bg-teal-50"
                          : "border-stone-300 bg-white"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="text"
                  value={answers[index]?.answer ?? ""}
                  onChange={(e) => {
                    const next = [...answers];
                    next[index] = { answer: e.target.value };
                    setAnswers(next);
                  }}
                  onBlur={() => void saveProgress(answers, index)}
                  className="w-full rounded border border-stone-300 px-3 py-2"
                  placeholder={t("practice.yourAnswer")}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  const nextIndex = Math.max(0, index - 1);
                  setIndex(nextIndex);
                  void saveProgress(answers, nextIndex);
                }}
                disabled={index === 0}
              >
                {t("common.back")}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  const nextIndex = Math.min(questions.length - 1, index + 1);
                  setIndex(nextIndex);
                  void saveProgress(answers, nextIndex);
                }}
                disabled={index >= questions.length - 1}
              >
                {t("common.next")}
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? t("common.loading") : t("exam.submitExam")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ExamTakePage() {
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
      <ExamTakeInner />
    </Suspense>
  );
}
