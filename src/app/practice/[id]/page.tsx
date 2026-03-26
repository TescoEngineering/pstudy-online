"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { Deck, PStudyItem } from "@/types/pstudy";
import { createClient } from "@/lib/supabase/client";
import { fetchDeck } from "@/lib/supabase/decks";
import {
  speak,
  speakWithCallback,
  stopSpeaking,
  startListening,
  isSpeechRecognitionSupported,
  prepareSpeechSynthesis,
  resolveDeckOnlyTranscript,
} from "@/lib/speech";
import { startCloudListening } from "@/lib/speech-cloud";
import { SPEECH_LANGUAGES } from "@/lib/speech-languages";
import {
  getExplanationWords,
  buildFlashcardDisplay,
  fillFromTranscript,
} from "@/lib/flashcard";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, ""); // Strip trailing punctuation (speech recognition often adds periods)
}

export default function PracticePage() {
  const params = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const id = params.id as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [mode, setMode] = useState<"straight" | "multiple-choice" | "flashcard">("straight");
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
  const [listenMode, setListenMode] = useState(false);
  const [speakMode, setSpeakMode] = useState(false);
  const [speechLang, setSpeechLang] = useState("en");
  const [vocabularyBias, setVocabularyBias] = useState(false);
  const [cloudSttAvailable, setCloudSttAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [flashcardFilled, setFlashcardFilled] = useState<(string | null)[]>([]);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const lastSpokenForRef = useRef<string | null>(null);
  const speakModeRef = useRef(speakMode);
  const showResultRef = useRef(showResult);
  const modeRef = useRef(mode);
  const questionTextRef = useRef("");
  speakModeRef.current = speakMode;
  showResultRef.current = showResult;
  modeRef.current = mode;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const d = await fetchDeck(id);
      setDeck(d ?? null);
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
    }
    load();
  }, [id, order, router]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/speech-to-text/status");
        const d = (await r.json()) as { available?: boolean };
        setCloudSttAvailable(!!d?.available);
      } catch {
        setCloudSttAvailable(false);
      }
    })();
  }, []);

  /** Browsers often block or suspend TTS until the user interacts with the page once. */
  useEffect(() => {
    const unlock = () => prepareSpeechSynthesis();
    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  const current = list[index];
  const total = list.length;

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, [current]);

  // Initialize flashcard state when item changes
  useEffect(() => {
    if (mode === "flashcard" && current) {
      const explanation = String(current.explanation ?? "").trim();
      const words = getExplanationWords(explanation);
      setFlashcardFilled(words.map(() => null));
      setFlashcardRevealed(false);
    }
  }, [current?.id, mode]);

  // Stop listening when result shown, speak off, or flashcard revealed
  useEffect(() => {
    if (
      showResult ||
      !speakMode ||
      (mode !== "straight" && mode !== "flashcard") ||
      (mode === "flashcard" && flashcardRevealed)
    ) {
      stopListeningRef.current?.();
      setIsListening(false);
      stopListeningRef.current = null;
    }
  }, [showResult, speakMode, mode, flashcardRevealed]);

  const flashcardFilledRef = useRef(flashcardFilled);
  flashcardFilledRef.current = flashcardFilled;

  const startSpeakListening = useCallback(async () => {
    const isFlashcard = mode === "flashcard";
    if (
      (mode !== "straight" && !isFlashcard) ||
      !speakMode ||
      showResult ||
      (isFlashcard && flashcardRevealed)
    )
      return;
    stopListeningRef.current?.();
    setIsListening(true);

    const deckVocabulary = isFlashcard
      ? [...new Set(getExplanationWords(String(current?.explanation ?? "")))]
      : [
          ...new Set(
            list
              .flatMap((it) => [
                String(it.description ?? "").trim(),
                String(it.explanation ?? "").trim(),
              ])
              .filter(Boolean)
          ),
        ];

    const vocabulary = deckVocabulary.length ? deckVocabulary : undefined;

    const handleResult = (transcript: string, isFinal: boolean) => {
      if (!isFinal || !transcript.trim()) return;
      if (isFlashcard) {
        const words = getExplanationWords(String(current?.explanation ?? ""));
        const prev = flashcardFilledRef.current;
        const next = fillFromTranscript(transcript.trim(), words, prev);
        setFlashcardFilled(next);
        return;
      }
      let newTranscript = transcript.trim();
      const q = questionTextRef.current.trim();
      // Deck answers are short phrases; stripping TTS/question prefixes often eats the whole utterance
      // on a retry (e.g. question text is a prefix of the state name) or corrupts it ("Wash" → "ington").
      if (q && !vocabularyBias) {
        for (let i = q.length; i >= 1; i--) {
          const prefix = q.slice(0, i);
          if (newTranscript.toLowerCase().startsWith(prefix.toLowerCase())) {
            newTranscript = newTranscript.slice(i).trim();
            break;
          }
        }
      }
      if (!newTranscript) return;
      if (vocabularyBias && vocabulary?.length) {
        const resolved = resolveDeckOnlyTranscript(newTranscript, vocabulary);
        if (resolved === null) return;
        setAnswer(resolved);
        return;
      }
      const currentAnswer = answerRef.current.trim();
      if (currentAnswer === "" || newTranscript === currentAnswer) {
        setAnswer(newTranscript);
      } else if (newTranscript.startsWith(currentAnswer) && newTranscript.length > currentAnswer.length) {
        const occurrences = currentAnswer ? newTranscript.split(currentAnswer).length - 1 : 0;
        if (occurrences <= 1) {
          setAnswer(newTranscript);
        } else {
          const lastIdx = newTranscript.lastIndexOf(currentAnswer);
          if (lastIdx !== -1) {
            const newPart = newTranscript.slice(lastIdx + currentAnswer.length).trim();
            if (newPart) {
              setAnswer((currentAnswer + " " + newPart).trim());
            }
          }
        }
      } else {
        setAnswer((prev) => (prev ? `${prev} ${newTranscript}` : newTranscript).trim());
      }
    };

    const handleError = (msg: string) => {
      toast.error(msg);
      setIsListening(false);
      stopListeningRef.current = null;
    };

    const handleEnd = () => {
      if (
        speakModeRef.current &&
        !showResultRef.current &&
        (modeRef.current === "straight" || modeRef.current === "flashcard")
      ) {
        startSpeakListening();
      }
    };

    let stop: (() => void) | null = null;
    const useVocabulary = isFlashcard || vocabularyBias;

    if (useVocabulary && vocabulary?.length) {
      try {
        const r = await fetch("/api/speech-to-text/status");
        const d = (await r.json()) as { available?: boolean };
        if (d?.available) {
          stop = startCloudListening({
            lang: speechLang,
            vocabulary,
            onResult: handleResult,
            onError: handleError,
            onEnd: handleEnd,
          });
        }
      } catch {
        // Fall through to Web Speech API
      }
    }

    if (!stop) {
      if (!isSpeechRecognitionSupported()) {
        setIsListening(false);
        stopListeningRef.current = null;
        toast.error(t("practice.speechInputUnavailable"));
        return;
      }
      stop = startListening({
        lang: speechLang,
        vocabulary,
        vocabularyOnly: useVocabulary,
        continuous: true,
        onResult: handleResult,
        onError: handleError,
        onEnd: handleEnd,
      });
    }

    if (!stop) {
      setIsListening(false);
      stopListeningRef.current = null;
    } else {
      stopListeningRef.current = stop;
    }
  }, [mode, speakMode, showResult, speechLang, vocabularyBias, list, promptMode, current, flashcardRevealed, toast, t]);

  // When item loads: if listenMode, speak the question (only once per item). If speakMode (and straight/flashcard), start listening after TTS ends.
  useEffect(() => {
    if (!current) return;
    // When instruction is not blank, it is the question; otherwise use explanation or description per promptMode
    const questionText = (current.instruction?.trim() || (promptMode === "description" ? current.explanation : current.description) || "").trim();
    questionTextRef.current = questionText;

    if (showResult || (mode === "flashcard" && flashcardRevealed)) return;

    // Only speak when we've moved to a new item, not when user just toggles Speak
    const isNewItem = lastSpokenForRef.current !== current.id;
    if (listenMode && questionText && isNewItem) {
      lastSpokenForRef.current = current.id;
      speakWithCallback(questionText, () => {
        setTimeout(startSpeakListening, 300);
      }, speechLang);
    } else {
      startSpeakListening();
    }
  }, [current, listenMode, speakMode, mode, promptMode, showResult, flashcardRevealed, startSpeakListening, speechLang]);

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
      .filter((s) => String(s ?? "").trim() !== "")
      .filter((v, i, a) => a.indexOf(v) === i);
    setMcOptions(shuffle(choices));
  }, [current, mode, promptMode]);

  const checkAnswer = useCallback(
    (userAnswer: string) => {
      const expected =
        promptMode === "description" ? current.description : current.explanation;
      const expectedStr = String(expected ?? "").trim();
      const ok =
        normalizeAnswer(userAnswer) === normalizeAnswer(expected);
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

      // When Listen is on, speak the evaluation feedback
      if (listenMode && expectedStr) {
        if (ok) {
          speak(`Correct: ${expectedStr}`, speechLang);
        } else {
          speak(`Incorrect; the correct answer was ${expectedStr}`, speechLang);
        }
      }
    },
    [current, promptMode, repeatMistakesMode, index, list.length, correct, wrong, originalTotal, total, id, router, listenMode, speechLang]
  );

  const goToResults = useCallback(() => {
    router.push(`/practice/${id}/result?correct=${correct}&wrong=${wrong}&total=${originalTotal || total}`);
  }, [correct, wrong, originalTotal, total, id, router]);

  const next = useCallback(() => {
    stopSpeaking();
    setAnswer("");
    setShowResult(false);
    setFlashcardRevealed(false);
    setFlashcardFilled([]);
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

  const revealFlashcard = useCallback(() => {
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    setFlashcardRevealed(true);
  }, []);

  function handleListenQuestion() {
    const text = (current.instruction?.trim() || (promptMode === "description" ? current.explanation : current.description) || "").trim();
    if (!text) return;
    // Stop speech recognition so it doesn't pick up the TTS
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    speakWithCallback(text.trim(), () => {
      // Restart listening after TTS ends (if speak mode is on)
      setTimeout(startSpeakListening, 300);
    }, speechLang);
  }

  function handleListenAnswer() {
    const text = promptMode === "description" ? current.description : current.explanation;
    if (text?.trim()) speak(text.trim(), speechLang);
  }

  const handleEnterToCheck = useCallback(() => {
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    checkAnswer(answerRef.current);
  }, [checkAnswer]);

  // Enter: when answering, check/reveal; when viewing result, go to next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;
      e.preventDefault();
      if (mode === "flashcard") {
        if (flashcardRevealed) {
          next();
        } else {
          revealFlashcard();
        }
        return;
      }
      if (showResult) {
        next();
      } else if (mode === "straight") {
        handleEnterToCheck();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [showResult, next, mode, handleEnterToCheck, flashcardRevealed, revealFlashcard]);

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-600">{t("practice.deckNotFound")}</p>
        <Link href="/dashboard" className="ml-2 text-pstudy-primary hover:underline">
          {t("result.backToDashboard")}
        </Link>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-stone-600">{t("practice.noItems")}</p>
        <Link href={`/deck/${id}`} className="btn-primary">
          {t("deck.editDeck")}
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
              <>{t("practice.repeatMistakesLeft", { count: list.length })} · ✓ {correct} ✗ {wrong}</>
            ) : (
              <>{index + 1} / {total} · ✓ {correct} ✗ {wrong}</>
            )}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-4">
          {index === 0 && (
            <>
              <label className="flex items-center gap-2">
                <span className="text-sm text-stone-600">{t("practice.askFor")}</span>
                <select
                  value={promptMode}
                  onChange={(e) =>
                    setPromptMode(e.target.value as "description" | "explanation")
                  }
                  disabled={mode === "flashcard"}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary disabled:bg-stone-100 disabled:text-stone-500"
                >
                  <option value="description">{t("practice.description")}</option>
                  <option value="explanation">{t("practice.explanation")}</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-stone-600">{t("practice.answerType")}</span>
                <select
                  value={mode}
                  onChange={(e) => {
                    const v = e.target.value as "straight" | "multiple-choice" | "flashcard";
                    setMode(v);
                    if (v === "flashcard") setPromptMode("explanation");
                  }}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                >
                  <option value="straight">{t("practice.straightAnswer")}</option>
                  <option value="multiple-choice">{t("practice.multipleChoice")}</option>
                  <option value="flashcard">{t("practice.flashcard")}</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-stone-600">{t("practice.order")}</span>
                <select
                  value={order}
                  onChange={(e) => setOrder(e.target.value as "normal" | "random")}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                >
                  <option value="normal">{t("practice.normalOrder")}</option>
                  <option value="random">{t("practice.randomOrder")}</option>
                </select>
              </label>
            </>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={listenMode}
              onChange={(e) => setListenMode(e.target.checked)}
              className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
            />
            <span className="text-sm text-stone-600">{t("practice.listenMode")}</span>
          </label>
          {(mode === "straight" || mode === "flashcard") &&
            (isSpeechRecognitionSupported() || cloudSttAvailable) && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={speakMode}
                onChange={(e) => setSpeakMode(e.target.checked)}
                className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
              />
              <span className="text-sm text-stone-600">{t("practice.speakMode")}</span>
            </label>
          )}
          {mode === "multiple-choice" && (
            <p className="w-full text-xs text-stone-500">{t("practice.speechMcNoMic")}</p>
          )}
          {(mode === "straight" || mode === "flashcard") && speakMode && mode === "straight" && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={vocabularyBias}
                onChange={(e) => setVocabularyBias(e.target.checked)}
                className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
              />
              <span className="text-sm text-stone-600">{t("practice.considerOnlyDeckAnswers")}</span>
            </label>
          )}
          <label className="flex items-center gap-2">
            <span className="text-sm text-stone-600">{t("practice.speechLanguage")}:</span>
            <select
              value={speechLang}
              onChange={(e) => setSpeechLang(e.target.value)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
            >
              {SPEECH_LANGUAGES.map(({ code, name }) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className="w-full text-xs text-stone-500">{t("practice.speechBrowserTip")}</p>
        </div>

        {repeatMistakesMode && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {t("practice.repeatMistakesLeft", { count: list.length })}
          </div>
        )}

        <div className="card mb-6">
          {current.instruction ? (
            <p className="text-sm text-stone-500">{current.instruction}</p>
          ) : null}
          <div className="mt-2 flex items-start justify-between gap-2">
            <h2 className="flex-1 text-xl font-semibold text-stone-900">
              {promptMode === "description" ? current.explanation : current.description}
            </h2>
            <button
              type="button"
              onClick={handleListenQuestion}
              className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 transition hover:border-pstudy-primary hover:text-pstudy-primary"
              title={t("practice.listenToQuestion")}
            >
              {t("common.listen")}
            </button>
          </div>
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    setAnswer(newVal);
                    if (speakMode && newVal === "" && stopListeningRef.current) {
                      stopListeningRef.current();
                      startSpeakListening();
                    }
                  }}
                  placeholder={t("practice.yourAnswer")}
                  className="flex-1 rounded-lg border border-stone-300 px-4 py-3 text-lg focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                  autoFocus
                />
                {speakMode && (
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm ${
                      isListening
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-500"
                    }`}
                    title={isListening ? "Listening... Press Enter to submit" : "Speak mode on"}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {isListening ? "Listening" : "Speak on"}
                  </span>
                )}
              </div>
            ) : mode === "flashcard" ? (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-stone-200 bg-white p-4">
                  <p className="whitespace-pre-wrap font-mono text-lg leading-relaxed text-stone-700">
                    {flashcardRevealed
                      ? current.explanation
                      : buildFlashcardDisplay(
                          getExplanationWords(String(current.explanation ?? "")),
                          flashcardFilled
                        )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {speakMode && !flashcardRevealed && (
                    <span
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${
                        isListening
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-stone-100 text-stone-500"
                      }`}
                      title={isListening ? "Listening... Speak words to fill in" : "Speak mode on"}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {isListening ? "Listening" : "Speak on"}
                    </span>
                  )}
                  {!flashcardRevealed ? (
                    <button onClick={revealFlashcard} className="btn-primary">
                      {t("practice.revealAnswer")}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleListenAnswer}
                        className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 transition hover:border-pstudy-primary hover:text-pstudy-primary"
                        title={t("practice.listenToAnswer")}
                      >
                        {t("common.listen")}
                      </button>
                      <button onClick={next} className="btn-primary">
                        {t("common.next")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {mcOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setAnswer(opt);
                      checkAnswer(opt);
                    }}
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
                normalizeAnswer(answer) ===
                normalizeAnswer(
                  promptMode === "description" ? current.description : current.explanation
                )
                  ? "border-green-500 bg-green-50"
                  : "border-red-400 bg-red-50"
              }`}
            >
              <p className="font-medium">
                {normalizeAnswer(answer) ===
                normalizeAnswer(
                  promptMode === "description" ? current.description : current.explanation
                )
                  ? t("common.correct")
                  : t("common.incorrect")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-stone-700">
                <span>
                  {t("common.answer")}:{" "}
                  <strong>
                    {promptMode === "description" ? current.description : current.explanation}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={handleListenAnswer}
                  className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs text-stone-600 hover:border-pstudy-primary hover:text-pstudy-primary"
                  title={t("practice.listenToAnswer")}
                >
                  {t("common.listen")}
                </button>
              </div>
            </div>
            <button onClick={next} className="btn-primary">
              {repeatMistakesMode
                ? list.length <= 1
                  ? t("practice.seeResults")
                  : t("common.next")
                : index + 1 >= total
                  ? wrongItems.length > 0
                    ? t("practice.repeatMistakes")
                    : t("practice.seeResults")
                  : t("common.next")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
