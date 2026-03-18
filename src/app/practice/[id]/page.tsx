"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Deck, PStudyItem } from "@/types/pstudy";

const STORAGE_KEY = "pstudy-decks";

function loadDecks(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [mode, setMode] = useState<"straight" | "multiple-choice">("straight");
  const [promptMode, setPromptMode] = useState<"description" | "explanation">(
    "description"
  );
  const [order, setOrder] = useState<"normal" | "random">("random");
  const [list, setList] = useState<PStudyItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [repeatMistakesMode, setRepeatMistakesMode] = useState(false);
  const [wrongItems, setWrongItems] = useState<PStudyItem[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);

  useEffect(() => {
    const decks = loadDecks();
    const d = decks.find((x) => x.id === id) ?? null;
    setDeck(d);
    if (d && d.items.length > 0) {
      const ordered =
        order === "random" ? shuffle(d.items) : [...d.items];
      setList(ordered);
      setIndex(0);
      setAnswer("");
      setShowResult(false);
      setRepeatMistakesMode(false);
      setWrongItems([]);
      setOriginalTotal(ordered.length);
    }
  }, [id, order]);

  const current = list[index];
  const total = list.length;

  useEffect(() => {
    if (!current || mode !== "multiple-choice") return;
    // Correct answer: Description mode → description; Explanation mode → explanation
    const correctAnswer =
      promptMode === "description" ? current.description : current.explanation;
    const choices = [
      correctAnswer,
      current.multiplechoice1,
      current.multiplechoice2,
      current.multiplechoice3,
      current.multiplechoice4,
    ]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    setMcOptions(shuffle(choices));
  }, [current, mode, promptMode]);

  const checkAnswer = useCallback(
    (userAnswer: string) => {
      const normalized = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      const expected =
        promptMode === "description" ? current.description : current.explanation;
      const ok =
        normalized(userAnswer) === normalized(expected);
      if (ok) {
        setCorrect((c) => c + 1);
        if (repeatMistakesMode) {
          setList((prev) => {
            const next = prev.filter((_, i) => i !== index);
            if (next.length === 0) {
              setTimeout(() => router.push(`/practice/${id}/result?correct=${correct + 1}&wrong=${wrong}&total=${originalTotal || total}`), 0);
            }
            return next;
          });
          setIndex(0);
          setShowResult(false);
          setAnswer("");
        }
      } else {
        setWrong((w) => w + 1);
        if (!repeatMistakesMode) {
          setWrongItems((prev) => [...prev, current]);
        } else {
          setList((prev) => {
            const item = prev[index];
            const rest = prev.filter((_, i) => i !== index);
            return [...rest, item];
          });
          setIndex(0);
        }
      }
      setShowResult(true);
    },
    [current, promptMode, repeatMistakesMode, index, list.length, correct, wrong, originalTotal, total, id, router]
  );

  const goToResults = useCallback(() => {
    router.push(`/practice/${id}/result?correct=${correct}&wrong=${wrong}&total=${originalTotal || total}`);
  }, [correct, wrong, originalTotal, total, id, router]);

  const next = useCallback(() => {
    setAnswer("");
    setShowResult(false);
    if (repeatMistakesMode) {
      return; // List/index already updated in checkAnswer
    }
    if (index + 1 >= total) {
      if (wrongItems.length > 0) {
        setList(shuffle(wrongItems));
        setIndex(0);
        setWrongItems([]);
        setRepeatMistakesMode(true);
      } else {
        goToResults();
      }
      return;
    }
    setIndex((i) => i + 1);
  }, [index, total, repeatMistakesMode, wrongItems, goToResults]);

  // When correction is shown, Enter advances to next item
  useEffect(() => {
    if (!showResult) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showResult, next]);

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-600">Deck not found.</p>
        <Link href="/dashboard" className="ml-2 text-pstudy-primary hover:underline">
          Dashboard
        </Link>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-stone-600">No items in this deck.</p>
        <Link href={`/deck/${id}`} className="btn-primary">
          Edit deck
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href={`/deck/${id}`} className="text-pstudy-primary hover:underline">
            ← {deck.title}
          </Link>
          <span className="text-stone-600">
            {repeatMistakesMode ? (
              <>Repeat mistakes: {list.length} left · ✓ {correct} ✗ {wrong}</>
            ) : (
              <>{index + 1} / {total} · ✓ {correct} ✗ {wrong}</>
            )}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {index === 0 && (
          <div className="mb-6 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-stone-600">Ask for</span>
              <select
                value={promptMode}
                onChange={(e) =>
                  setPromptMode(e.target.value as "description" | "explanation")
                }
                className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                <option value="description">Description</option>
                <option value="explanation">Explanation</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "straight"}
                onChange={() => setMode("straight")}
              />
              Straight answer
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "multiple-choice"}
                onChange={() => setMode("multiple-choice")}
              />
              Multiple choice
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="order"
                checked={order === "normal"}
                onChange={() => setOrder("normal")}
              />
              Normal order
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="order"
                checked={order === "random"}
                onChange={() => setOrder("random")}
              />
              Random
            </label>
          </div>
        )}

        {repeatMistakesMode && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Repeat mistakes — {list.length} item{list.length !== 1 ? "s" : ""} remaining
          </div>
        )}

        <div className="card mb-6">
          {current.instruction ? (
            <p className="text-sm text-stone-500">{current.instruction}</p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold text-stone-900">
            {promptMode === "description" ? current.explanation : current.description}
          </h2>
          {current.picture_url && (
            <div className="mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.picture_url}
                alt="Item picture"
                className="max-h-64 w-full rounded-lg object-contain ring-1 ring-stone-200"
              />
            </div>
          )}
        </div>

        {!showResult ? (
          <>
            {mode === "straight" ? (
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    checkAnswer(answer);
                  }
                }}
                placeholder="Your answer (press Enter to check)"
                className="w-full rounded-lg border border-stone-300 px-4 py-3 text-lg focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                autoFocus
              />
            ) : (
              <div className="flex flex-col gap-2">
                {mcOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => checkAnswer(opt)}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-left transition hover:border-pstudy-primary hover:bg-teal-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div
              className={`rounded-lg border-2 p-4 ${
                answer.trim().toLowerCase() ===
                (promptMode === "description" ? current.description : current.explanation)
                  .trim()
                  .toLowerCase()
                  ? "border-green-500 bg-green-50"
                  : "border-red-400 bg-red-50"
              }`}
            >
              <p className="font-medium">
                {answer.trim().toLowerCase() ===
                (promptMode === "description" ? current.description : current.explanation)
                  .trim()
                  .toLowerCase()
                  ? "Correct!"
                  : "Incorrect."}
              </p>
              <p className="mt-1 text-stone-700">
                Answer:{" "}
                <strong>
                  {promptMode === "description" ? current.description : current.explanation}
                </strong>
              </p>
            </div>
            <button onClick={next} className="btn-primary">
              {repeatMistakesMode
                ? list.length <= 1
                  ? "See results"
                  : "Next"
                : index + 1 >= total
                  ? wrongItems.length > 0
                    ? "Repeat mistakes"
                    : "See results"
                  : "Next"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
