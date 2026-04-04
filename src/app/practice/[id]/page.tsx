"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { HelpNavLink } from "@/components/HelpNavLink";
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
  applyUserAliasesToTranscript,
} from "@/lib/speech";
import {
  loadDeckSttAliases,
  normalizeSttAliasKey,
  saveDeckSttAliases,
} from "@/lib/speech-deck-aliases";
import { startCloudListening } from "@/lib/speech-cloud";
import { SPEECH_LANGUAGES } from "@/lib/speech-languages";
import {
  parseFlashcardRevealSegments,
  splitKeywordTags,
  splitKeywordTagsForHighlight,
} from "@/lib/flashcard";
import { FlashcardKeywordHighlight } from "@/components/FlashcardKeywordHighlight";
import {
  countKnownInDeck,
  isItemKnown,
  setItemKnown,
} from "@/lib/deck-known-cards";

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

/** Don't strip question echoes shorter than this — avoids "What's…" matching only "W" and mangling "Washington". */
const MIN_QUESTION_ECHO_PREFIX_LEN = 3;

/** Listen mode TTS: read instruction and main line when both are set (matches on-screen question + hint). */
function listenQuestionSpeechText(item: PStudyItem, promptMode: "description" | "explanation"): string {
  const inst = (item.instruction?.trim() || "").trim();
  const main = ((promptMode === "description" ? item.explanation : item.description)?.trim() || "").trim();
  if (inst && main) return `${inst}. ${main}`;
  return inst || main;
}

function FlashcardRevealedView({
  text,
  keywordTags,
  compareText,
  side,
}: {
  text: string;
  keywordTags: string[];
  compareText: string;
  side: "official" | "user";
}) {
  const raw = String(text ?? "");
  const segs = parseFlashcardRevealSegments(raw);
  if (segs.length === 0) {
    if (raw.trim()) {
      return (
        <p className="font-mono text-lg leading-relaxed text-stone-800">
          <FlashcardKeywordHighlight
            text={raw}
            keywordTags={keywordTags}
            compareText={compareText}
            side={side}
          />
        </p>
      );
    }
    return <p className="text-stone-500">—</p>;
  }
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];
  let ulKey = 0;
  const flushBullets = () => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`ul-${ulKey++}`} className="list-disc space-y-1 pl-5">
        {bullets.map((b, i) => (
          <li key={i} className="font-mono text-lg leading-relaxed text-stone-800">
            <FlashcardKeywordHighlight
              text={b}
              keywordTags={keywordTags}
              compareText={compareText}
              side={side}
            />
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };
  for (let idx = 0; idx < segs.length; idx++) {
    const s = segs[idx];
    if (s.type === "bullet") bullets.push(s.text);
    else {
      flushBullets();
      nodes.push(
        <p key={`p-${idx}`} className="font-mono text-lg leading-relaxed text-stone-800">
          <FlashcardKeywordHighlight
            text={s.text}
            keywordTags={keywordTags}
            compareText={compareText}
            side={side}
          />
        </p>
      );
    }
  }
  flushBullets();
  return <div className="space-y-2">{nodes}</div>;
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
  /** Card being graded while result pane is open (avoids picture/question jumping if index advances early). */
  const [resultCardItem, setResultCardItem] = useState<PStudyItem | null>(null);
  const [mcOptions, setMcOptions] = useState<string[]>([]);
  const [repeatMistakesMode, setRepeatMistakesMode] = useState(false);
  const [wrongItems, setWrongItems] = useState<PStudyItem[]>([]);
  const wrongItemsRef = useRef(wrongItems);
  wrongItemsRef.current = wrongItems;
  const [originalTotal, setOriginalTotal] = useState(0);
  const [listenMode, setListenMode] = useState(false);
  const [speakMode, setSpeakMode] = useState(false);
  const [speechLang, setSpeechLang] = useState(() => {
    if (typeof window === "undefined") return "en";
    try {
      const s = localStorage.getItem("pstudy-speech-lang");
      return s && s.trim() ? s.trim() : "en";
    } catch {
      return "en";
    }
  });
  const [vocabularyBias, setVocabularyBias] = useState(false);
  const [showSttHeardDebug, setShowSttHeardDebug] = useState(false);
  const [lastHeardRaw, setLastHeardRaw] = useState("");
  /** Stable STT→UI bridge so async chunk callbacks always hit the latest setLastHeardRaw. */
  const heardLineDispatch = useRef<(line: string) => void>(() => {});
  heardLineDispatch.current = (line: string) => {
    const t = line.trim();
    if (t) setLastHeardRaw(t);
  };
  const onHeardLineStable = useCallback((line: string) => {
    heardLineDispatch.current(line);
  }, []);
  const [sttGoogle, setSttGoogle] = useState(false);
  const cloudSttAvailable = sttGoogle;
  /** Flashcard only: compare Google chunk STT vs browser Web Speech (saved in this browser). */
  const [flashcardSttEngine, setFlashcardSttEngine] = useState<"google" | "browser">(() => {
    if (typeof window === "undefined") return "browser";
    const s = localStorage.getItem("pstudy-flashcard-stt");
    if (s === "google") return "google";
    return "browser";
  });
  /** Per-deck STT heard → answer; optional advanced mappings (localStorage). */
  const [sttAliasRows, setSttAliasRows] = useState<{ from: string; to: string }[]>([]);
  const [sttAliasesHydrated, setSttAliasesHydrated] = useState(false);
  /** While open, practice mic/STT is off so mappings don’t fight the exercise. */
  const [speechMappingPanelOpen, setSpeechMappingPanelOpen] = useState(false);
  const [exerciseSetupOpen, setExerciseSetupOpen] = useState(true);
  const speechMappingPanelOpenRef = useRef(false);
  speechMappingPanelOpenRef.current = speechMappingPanelOpen;
  const [isListening, setIsListening] = useState(false);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const flashcardRevealedRef = useRef(flashcardRevealed);
  flashcardRevealedRef.current = flashcardRevealed;
  /** Flashcard session: practice all cards or only those not marked "known" (localStorage). */
  const [flashcardCardFilter, setFlashcardCardFilter] = useState<"all" | "unknown">("all");
  /** Flashcard: flip through cards without answering (warm-up before practice). */
  const [flashcardBrowseOnly, setFlashcardBrowseOnly] = useState(false);
  const flashcardBrowseOnlyRef = useRef(false);
  /** Bumps after toggling "known" so labels that read localStorage re-render. */
  const [knownUiBump, setKnownUiBump] = useState(0);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const skipSttAliasSaveRef = useRef(false);
  const answerRef = useRef(answer);
  answerRef.current = answer;
  const lastSpokenForRef = useRef<string | null>(null);
  const speakModeRef = useRef(speakMode);
  const showResultRef = useRef(showResult);
  const modeRef = useRef(mode);
  const questionTextRef = useRef("");
  /** After check (Enter), answer field unmounts — move focus here so it doesn’t jump to the setup summary. */
  const practiceResultNextRef = useRef<HTMLButtonElement>(null);
  /** Invalidates in-flight async `startSpeakListening` (fetch + mic) when the item or phase changes. */
  const listenSeqRef = useRef(0);
  /** True from Enter-to-check until result state commits — blocks speech `onend` from restarting the mic too early. */
  const answerCheckPendingRef = useRef(false);
  /** Cancels stale “resume listen after TTS” timeouts when advancing quickly. */
  const ttsAfterListenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Blocks re-entrant `next()` (double Enter / double-click) which batches two `setIndex(i=>i+1)` and overshoots `list.length`. */
  const nextInFlightRef = useRef(false);
  /** Abort in-flight `/api/speech-to-text/status` when starting a new listen session. */
  const listenStatusAbortRef = useRef<AbortController | null>(null);
  /** Debounced Web Speech `onend` → restart; avoids tight restart loops that destabilize Chrome after many cycles. */
  const listenRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Debounce localStorage writes for STT aliases (mapping editor / panel). */
  const aliasSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bumpListenGeneration = useCallback(() => {
    listenSeqRef.current++;
    listenStatusAbortRef.current?.abort();
    listenStatusAbortRef.current = null;
    if (listenRestartTimerRef.current) {
      clearTimeout(listenRestartTimerRef.current);
      listenRestartTimerRef.current = null;
    }
  }, []);

  speakModeRef.current = speakMode;
  showResultRef.current = showResult;
  modeRef.current = mode;
  flashcardBrowseOnlyRef.current = flashcardBrowseOnly;

  const deckAnswerVocabulary = useMemo(() => {
    if (!list.length) return [];
    return [
      ...new Set(
        list
          .flatMap((it) => [
            String(it.description ?? "").trim(),
            String(it.explanation ?? "").trim(),
            ...splitKeywordTags(String(it.keywords ?? "")),
          ])
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [list]);

  const deckSttAliasesRecord = useMemo(() => {
    const r: Record<string, string> = {};
    for (const row of sttAliasRows) {
      const nk = normalizeSttAliasKey(row.from);
      if (nk && row.to.trim()) r[nk] = row.to.trim();
    }
    return r;
  }, [sttAliasRows]);

  useEffect(() => {
    skipSttAliasSaveRef.current = true;
    const m = loadDeckSttAliases(id);
    setSttAliasRows(Object.entries(m).map(([from, to]) => ({ from, to })));
    setSttAliasesHydrated(true);
  }, [id]);

  useEffect(() => {
    if (!sttAliasesHydrated) return;
    if (skipSttAliasSaveRef.current) {
      skipSttAliasSaveRef.current = false;
      return;
    }
    if (aliasSaveTimerRef.current) {
      clearTimeout(aliasSaveTimerRef.current);
      aliasSaveTimerRef.current = null;
    }
    aliasSaveTimerRef.current = setTimeout(() => {
      aliasSaveTimerRef.current = null;
      saveDeckSttAliases(id, deckSttAliasesRecord);
    }, 500);
    return () => {
      if (aliasSaveTimerRef.current) {
        clearTimeout(aliasSaveTimerRef.current);
        aliasSaveTimerRef.current = null;
      }
    };
  }, [id, deckSttAliasesRecord, sttAliasesHydrated]);

  /**
   * Seed “What STT heard” only while the mappings panel is open.
   * When the panel is closed, `lastHeardRaw` updates on every STT tick during Speak mode — syncing
   * here used to hammer setState + localStorage saves and could freeze or kill the tab after dozens
   * of answers. Use “Add row from last Heard” during practice, or open the panel to auto-fill once.
   */
  useEffect(() => {
    if (!speechMappingPanelOpen) return;
    const heard = lastHeardRaw.trim();
    if (!heard) return;
    setSttAliasRows((prev) => {
      const emptyIdx = prev.findIndex((r) => !r.from.trim());
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...next[emptyIdx], from: heard };
        return next;
      }
      if (prev.length === 0) {
        return [{ from: heard, to: "" }];
      }
      return prev;
    });
  }, [lastHeardRaw, speechMappingPanelOpen]);

  useEffect(() => {
    if (!speechMappingPanelOpen) return;
    bumpListenGeneration();
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
  }, [speechMappingPanelOpen, bumpListenGeneration]);

  useEffect(() => {
    try {
      localStorage.setItem("pstudy-speech-lang", speechLang);
    } catch {
      /* ignore */
    }
  }, [speechLang]);

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
      const d = await fetchDeck(id);
      setDeck(d ?? null);
    }
    void load();
  }, [id, router]);

  useEffect(() => {
    if (!deck || deck.items.length === 0) {
      setList([]);
      setOriginalTotal(0);
      return;
    }
    let ordered =
      order === "random" ? shuffle([...deck.items]) : [...deck.items];
    if (mode === "flashcard" && flashcardCardFilter === "unknown") {
      ordered = ordered.filter((it) => !isItemKnown(id, it.id));
    }
    setList(ordered);
    setIndex(0);
    setAnswer("");
    setShowResult(false);
    setResultCardItem(null);
    setRepeatMistakesMode(false);
    setWrongItems([]);
    setOriginalTotal(ordered.length);
    setFlashcardRevealed(false);
  }, [deck, order, mode, flashcardCardFilter, id]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/speech-to-text/status");
        const d = (await r.json()) as {
          available?: boolean;
          google?: boolean;
        };
        setSttGoogle(!!d.google);
      } catch {
        setSttGoogle(false);
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

  const total = list.length;
  const displayIndex =
    total === 0 ? 0 : Math.min(Math.max(0, index), total - 1);
  const current: PStudyItem | undefined =
    total > 0 ? list[displayIndex] : undefined;
  /** While the result pane is open, keep header + image on the card that was graded (list/index may already point at the next item in repeat-mistakes mode). */
  const displayCard: PStudyItem | undefined =
    showResult && resultCardItem ? resultCardItem : current;

  const flashcardKeywordTags = useMemo(() => {
    const card = displayCard ?? current;
    return card ? splitKeywordTagsForHighlight(String(card.keywords ?? "")) : [];
  }, [displayCard, current]);

  useLayoutEffect(() => {
    if (total === 0) return;
    if (index !== displayIndex) {
      setIndex(displayIndex);
    }
  }, [total, index, displayIndex]);

  useLayoutEffect(() => {
    nextInFlightRef.current = false;
  }, [index, showResult, total]);

  useEffect(() => {
    return () => {
      bumpListenGeneration();
      if (ttsAfterListenTimerRef.current) {
        clearTimeout(ttsAfterListenTimerRef.current);
        ttsAfterListenTimerRef.current = null;
      }
      stopSpeaking();
      stopListeningRef.current?.();
    };
  }, [current, bumpListenGeneration]);

  useEffect(() => {
    if (mode === "flashcard" && current) {
      setFlashcardRevealed(false);
      setAnswer("");
    }
  }, [current?.id, mode]);

  useEffect(() => {
    if (mode !== "flashcard") return;
    setFlashcardRevealed(false);
    setAnswer("");
  }, [promptMode, mode]);

  useEffect(() => {
    if (mode !== "flashcard") setFlashcardBrowseOnly(false);
  }, [mode]);

  useEffect(() => {
    if (repeatMistakesMode) setFlashcardBrowseOnly(false);
  }, [repeatMistakesMode]);

  useEffect(() => {
    if (mode === "flashcard" && flashcardBrowseOnly) {
      setFlashcardRevealed(false);
      setAnswer("");
      bumpListenGeneration();
      stopListeningRef.current?.();
      setIsListening(false);
      stopListeningRef.current = null;
    }
  }, [flashcardBrowseOnly, mode, bumpListenGeneration]);

  useEffect(() => {
    setLastHeardRaw("");
  }, [current?.id]);

  // Stop listening when result shown, speak off, or flashcard revealed
  useEffect(() => {
    if (
      showResult ||
      !speakMode ||
      (mode !== "straight" && mode !== "flashcard") ||
      (mode === "flashcard" && flashcardRevealed)
    ) {
      bumpListenGeneration();
      stopListeningRef.current?.();
      setIsListening(false);
      stopListeningRef.current = null;
    }
  }, [showResult, speakMode, mode, flashcardRevealed, bumpListenGeneration]);

  useEffect(() => {
    if (showResult) answerCheckPendingRef.current = false;
  }, [showResult]);

  const startSpeakListening = useCallback(async () => {
    const isFlashcard = mode === "flashcard";
    if (isFlashcard && flashcardBrowseOnly) return;
    if (
      (mode !== "straight" && !isFlashcard) ||
      !speakMode ||
      showResult ||
      (isFlashcard && flashcardRevealed) ||
      speechMappingPanelOpenRef.current
    )
      return;
    bumpListenGeneration();
    const seq = listenSeqRef.current;
    stopListeningRef.current?.();
    setIsListening(false);

    await new Promise((r) => setTimeout(r, 100));

    if (seq !== listenSeqRef.current) return;
    const afterDelayFlashcard = modeRef.current === "flashcard";
    if (
      (modeRef.current !== "straight" && !afterDelayFlashcard) ||
      !speakModeRef.current ||
      showResultRef.current ||
      (afterDelayFlashcard && flashcardBrowseOnlyRef.current) ||
      (afterDelayFlashcard && flashcardRevealedRef.current) ||
      speechMappingPanelOpenRef.current
    ) {
      return;
    }

    setIsListening(true);

    const deckVocabulary =
      deckAnswerVocabulary.length > 0 ? [...deckAnswerVocabulary] : [];
    /** Flashcard + speak: freeform answer — no deck phrase hints or vocab snapping (evaluation is user flip). */
    const vocabulary = afterDelayFlashcard
      ? undefined
      : deckVocabulary.length
        ? deckVocabulary
        : undefined;

    const handleResult = (transcript: string, isFinal: boolean) => {
      if (!isFinal) return;
      if (seq !== listenSeqRef.current) return;

      if (!transcript.trim()) return;

      let newTranscript = transcript.trim();
      const q = questionTextRef.current.trim();
      // Optional: strip spoken question echo from the mic (same for straight and flashcard; does not snap to deck answers).
      if (q && !vocabularyBias) {
        for (let i = q.length; i >= 1; i--) {
          if (i < MIN_QUESTION_ECHO_PREFIX_LEN && i < q.length) continue;
          const prefix = q.slice(0, i);
          if (newTranscript.toLowerCase().startsWith(prefix.toLowerCase())) {
            newTranscript = newTranscript.slice(i).trim();
            break;
          }
        }
      }
      if (!newTranscript) return;
      if (!afterDelayFlashcard && vocabularyBias && vocabulary?.length) {
        const resolved = resolveDeckOnlyTranscript(
          newTranscript,
          vocabulary,
          deckSttAliasesRecord
        );
        if (resolved === null) return;
        setAnswer(resolved);
        return;
      }
      if (
        !afterDelayFlashcard &&
        vocabulary?.length &&
        Object.keys(deckSttAliasesRecord).length > 0
      ) {
        newTranscript = applyUserAliasesToTranscript(
          newTranscript,
          vocabulary,
          deckSttAliasesRecord
        );
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
      if (seq !== listenSeqRef.current) return;
      toast.error(msg);
      setIsListening(false);
      stopListeningRef.current = null;
    };

    const onHeardGuarded = (line: string) => {
      if (seq !== listenSeqRef.current) return;
      onHeardLineStable(line);
    };

    const handleEnd = () => {
      if (seq !== listenSeqRef.current) return;
      if (answerCheckPendingRef.current) return;
      if (speechMappingPanelOpenRef.current) return;
      if (
        !speakModeRef.current ||
        showResultRef.current ||
        (modeRef.current !== "straight" && modeRef.current !== "flashcard")
      ) {
        return;
      }
      if (listenRestartTimerRef.current) {
        clearTimeout(listenRestartTimerRef.current);
        listenRestartTimerRef.current = null;
      }
      listenRestartTimerRef.current = setTimeout(() => {
        listenRestartTimerRef.current = null;
        if (seq !== listenSeqRef.current) return;
        if (answerCheckPendingRef.current) return;
        if (speechMappingPanelOpenRef.current) return;
        if (
          !speakModeRef.current ||
          showResultRef.current ||
          (modeRef.current !== "straight" && modeRef.current !== "flashcard")
        ) {
          return;
        }
        startSpeakListening();
      }, 380);
    };

    let stop: (() => void) | null = null;
    const vocabularyOnly = vocabularyBias && !afterDelayFlashcard;
    const useFlashcardGoogle =
      afterDelayFlashcard && flashcardSttEngine === "google";

    const tryCloudGoogle =
      (vocabularyBias && !afterDelayFlashcard && !!vocabulary?.length) ||
      (afterDelayFlashcard && useFlashcardGoogle);

    if (tryCloudGoogle) {
      listenStatusAbortRef.current = new AbortController();
      const { signal } = listenStatusAbortRef.current;
      try {
        const r = await fetch("/api/speech-to-text/status", { signal });
        const d = (await r.json()) as {
          available?: boolean;
          google?: boolean;
        };

        if (d.google) {
          stop = startCloudListening({
            lang: speechLang,
            // Flashcard: omit phrases/aliases so Google returns open transcription (no deck forcing).
            vocabulary: afterDelayFlashcard ? undefined : vocabulary,
            sttAliases: afterDelayFlashcard ? undefined : deckSttAliasesRecord,
            onResult: handleResult,
            onHeardLine: onHeardGuarded,
            onError: handleError,
            onEnd: handleEnd,
            shouldIgnoreResults: () => seq !== listenSeqRef.current,
          });
        }
      } catch {
        if (seq !== listenSeqRef.current) return;
        // Fall through to Web Speech API
      }
    }

    if (seq !== listenSeqRef.current) {
      if (stop) stop();
      setIsListening(false);
      return;
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
        vocabularyOnly,
        sttAliases:
          afterDelayFlashcard
            ? undefined
            : vocabularyOnly || Object.keys(deckSttAliasesRecord).length > 0
              ? deckSttAliasesRecord
              : undefined,
        continuous: true,
        onResult: handleResult,
        onHeardLine: onHeardGuarded,
        onError: handleError,
        onEnd: handleEnd,
      });
    }

    if (seq !== listenSeqRef.current) {
      if (stop) stop();
      setIsListening(false);
      return;
    }

    if (!stop) {
      setIsListening(false);
      stopListeningRef.current = null;
    } else {
      stopListeningRef.current = stop;
    }
  }, [
    mode,
    speakMode,
    showResult,
    speechLang,
    vocabularyBias,
    promptMode,
    current,
    flashcardRevealed,
    toast,
    t,
    onHeardLineStable,
    deckSttAliasesRecord,
    flashcardSttEngine,
    bumpListenGeneration,
    deckAnswerVocabulary,
    flashcardBrowseOnly,
  ]);

  // When item loads: if listenMode, speak the question (only once per item). If speakMode (and straight/flashcard), start listening after TTS ends.
  useEffect(() => {
    if (!displayCard) return;
    const questionText = listenQuestionSpeechText(displayCard, promptMode).trim();
    questionTextRef.current = questionText;

    if (showResult || (mode === "flashcard" && flashcardRevealed)) return;

    // Only speak when we've moved to a new item, not when user just toggles Speak
    const isNewItem = lastSpokenForRef.current !== displayCard.id;
    if (listenMode && questionText && isNewItem) {
      lastSpokenForRef.current = displayCard.id;
      speakWithCallback(questionText, () => {
        if (ttsAfterListenTimerRef.current) {
          clearTimeout(ttsAfterListenTimerRef.current);
          ttsAfterListenTimerRef.current = null;
        }
        ttsAfterListenTimerRef.current = setTimeout(() => {
          ttsAfterListenTimerRef.current = null;
          startSpeakListening();
        }, 300);
      }, speechLang);
    } else {
      startSpeakListening();
    }
  }, [
    displayCard,
    listenMode,
    speakMode,
    mode,
    promptMode,
    showResult,
    flashcardRevealed,
    startSpeakListening,
    speechLang,
    speechMappingPanelOpen,
  ]);

  useEffect(() => {
    if (!showResult) return;
    const id = requestAnimationFrame(() => {
      practiceResultNextRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [showResult]);

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
      if (!current) return;
      const expected =
        promptMode === "description" ? current.description : current.explanation;
      const expectedStr = String(expected ?? "").trim();
      const ok =
        normalizeAnswer(userAnswer) === normalizeAnswer(expected);
      if (ok) {
        setCorrect((c) => c + 1);
        if (repeatMistakesMode) {
          setList((prev) => {
            const next = prev.filter((_, i) => i !== displayIndex);
            if (next.length === 0) {
              setTimeout(() => router.push(`/practice/${id}/result?correct=${correct + 1}&wrong=${wrong}&total=${originalTotal || total}`), 0);
            }
            return next;
          });
          setIndex(0);
          setShowResult(false);
          setResultCardItem(null);
          setAnswer("");
        }
      } else {
        setWrong((w) => w + 1);
        if (!repeatMistakesMode) {
          setWrongItems((prev) => [...prev, current]);
        } else {
          setList((prev) => {
            const item = prev[displayIndex];
            if (item === undefined) return prev;
            const rest = prev.filter((_, i) => i !== displayIndex);
            return [...rest, item];
          });
          setIndex(0);
        }
      }

      // Repeat-mistakes correct answer: inner block already set showResult false and advanced the list.
      // Do not force showResult true here — that reused the last-spoken id for Listen and trapped the UI on the result pane.
      if (!(ok && repeatMistakesMode)) {
        setResultCardItem(current);
        setShowResult(true);
      }

      // When Listen is on, speak the evaluation feedback
      if (listenMode && expectedStr) {
        if (ok) {
          speak(`Correct: ${expectedStr}`, speechLang);
        } else {
          speak(`Incorrect; the correct answer was ${expectedStr}`, speechLang);
        }
      }
    },
    [current, displayIndex, promptMode, repeatMistakesMode, list.length, correct, wrong, originalTotal, total, id, router, listenMode, speechLang]
  );


  const goToResults = useCallback(() => {
    router.push(`/practice/${id}/result?correct=${correct}&wrong=${wrong}&total=${originalTotal || total}`);
  }, [correct, wrong, originalTotal, total, id, router]);

  const next = useCallback(() => {
    if (nextInFlightRef.current) return;
    nextInFlightRef.current = true;
    bumpListenGeneration();
    if (ttsAfterListenTimerRef.current) {
      clearTimeout(ttsAfterListenTimerRef.current);
      ttsAfterListenTimerRef.current = null;
    }
    stopSpeaking();
    setAnswer("");
    setShowResult(false);
    setResultCardItem(null);
    setFlashcardRevealed(false);
    if (mode === "flashcard" && flashcardBrowseOnly && !repeatMistakesMode) {
      if (displayIndex + 1 >= total) setIndex(0);
      else setIndex((i) => i + 1);
      return;
    }
    if (repeatMistakesMode) {
      return; // List/index already updated in checkAnswer
    }
    if (displayIndex + 1 >= total) {
      const toRepeat = wrongItemsRef.current;
      if (toRepeat.length > 0) {
        // New round of wrong-only cards — reset so Listen/TTS treats the first card as new (same id as last main-round card otherwise skipped).
        lastSpokenForRef.current = null;
        setList(shuffle(toRepeat));
        setIndex(0);
        setWrongItems([]);
        setRepeatMistakesMode(true);
      } else {
        goToResults();
      }
      return;
    }
    setIndex((i) => i + 1);
  }, [
    displayIndex,
    total,
    repeatMistakesMode,
    goToResults,
    bumpListenGeneration,
    mode,
    flashcardBrowseOnly,
    repeatMistakesMode,
  ]);

  const prev = useCallback(() => {
    if (nextInFlightRef.current) return;
    nextInFlightRef.current = true;
    bumpListenGeneration();
    if (ttsAfterListenTimerRef.current) {
      clearTimeout(ttsAfterListenTimerRef.current);
      ttsAfterListenTimerRef.current = null;
    }
    stopSpeaking();
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    setAnswer("");
    setShowResult(false);
    setResultCardItem(null);
    setFlashcardRevealed(false);
    if (total <= 0) return;
    setIndex((i) => (i <= 0 ? total - 1 : i - 1));
  }, [total, bumpListenGeneration]);

  const revealFlashcard = useCallback(() => {
    bumpListenGeneration();
    if (ttsAfterListenTimerRef.current) {
      clearTimeout(ttsAfterListenTimerRef.current);
      ttsAfterListenTimerRef.current = null;
    }
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    setFlashcardRevealed(true);
  }, [bumpListenGeneration]);

  function handleListenQuestion() {
    if (!displayCard) return;
    const text = listenQuestionSpeechText(displayCard, promptMode).trim();
    if (!text) return;
    // Stop speech recognition so it doesn't pick up the TTS
    bumpListenGeneration();
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    if (ttsAfterListenTimerRef.current) {
      clearTimeout(ttsAfterListenTimerRef.current);
      ttsAfterListenTimerRef.current = null;
    }
    speakWithCallback(text.trim(), () => {
      if (ttsAfterListenTimerRef.current) {
        clearTimeout(ttsAfterListenTimerRef.current);
        ttsAfterListenTimerRef.current = null;
      }
      ttsAfterListenTimerRef.current = setTimeout(() => {
        ttsAfterListenTimerRef.current = null;
        startSpeakListening();
      }, 300);
    }, speechLang);
  }

  function handleListenAnswer() {
    if (!displayCard) return;
    const text =
      promptMode === "description" ? displayCard.description : displayCard.explanation;
    if (text?.trim()) speak(text.trim(), speechLang);
  }

  const handleEnterToCheck = useCallback(() => {
    answerCheckPendingRef.current = true;
    bumpListenGeneration();
    if (ttsAfterListenTimerRef.current) {
      clearTimeout(ttsAfterListenTimerRef.current);
      ttsAfterListenTimerRef.current = null;
    }
    stopListeningRef.current?.();
    setIsListening(false);
    stopListeningRef.current = null;
    checkAnswer(answerRef.current);
  }, [checkAnswer, bumpListenGeneration]);

  // Enter (flashcard answering): newline in textarea. Shift+Enter: flip. After reveal: Enter = next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat) return;

      if (mode === "flashcard") {
        if (flashcardBrowseOnly) {
          if (!flashcardRevealed) {
            e.preventDefault();
            revealFlashcard();
            return;
          }
          if (e.shiftKey) return;
          e.preventDefault();
          next();
          return;
        }
        if (!flashcardRevealed) {
          if (e.shiftKey) {
            e.preventDefault();
            revealFlashcard();
          }
          return;
        }
        if (e.shiftKey) return;
        e.preventDefault();
        next();
        return;
      }

      e.preventDefault();
      if (showResult) {
        next();
      } else if (mode === "straight") {
        handleEnterToCheck();
      } else if (mode === "multiple-choice" && answer.trim()) {
        handleEnterToCheck();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    showResult,
    next,
    mode,
    answer,
    handleEnterToCheck,
    flashcardRevealed,
    revealFlashcard,
    flashcardBrowseOnly,
  ]);

  if (!deck) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <p className="text-stone-600">{t("practice.deckNotFound")}</p>
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            {t("result.backToDashboard")}
          </Link>
        </div>
        <HelpNavLink />
      </div>
    );
  }

  if (list.length === 0) {
    const filteredFlashcardEmpty =
      !!deck &&
      deck.items.length > 0 &&
      mode === "flashcard" &&
      flashcardCardFilter === "unknown";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="max-w-md text-center text-stone-600">
          {filteredFlashcardEmpty
            ? t("practice.flashcardAllKnownMessage")
            : t("practice.noItems")}
        </p>
        {filteredFlashcardEmpty ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setFlashcardCardFilter("all")}
          >
            {t("practice.flashcardPracticeAllInstead")}
          </button>
        ) : (
          <Link href={`/deck/${id}`} className="btn-primary">
            {t("deck.editDeck")}
          </Link>
        )}
        <HelpNavLink />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <Link href={`/deck/${id}`} className="btn-primary">
          {t("deck.editDeck")}
        </Link>
        <HelpNavLink />
      </div>
    );
  }

  const activeCard: PStudyItem = displayCard ?? current;
  const visibleSideText =
    promptMode === "description"
      ? String(activeCard.explanation ?? "")
      : String(activeCard.description ?? "");
  const hiddenSideCorrect =
    promptMode === "description"
      ? String(activeCard.description ?? "")
      : String(activeCard.explanation ?? "");

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <Link href={`/deck/${id}`} className="text-pstudy-primary hover:underline">
            ← {deck.title}
          </Link>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-stone-600">
              {repeatMistakesMode ? (
                <>{t("practice.repeatMistakesLeft", { count: list.length })} · ✓ {correct} ✗ {wrong}</>
              ) : mode === "flashcard" && flashcardBrowseOnly ? (
                <>
                  {t("practice.flashcardBrowseProgress", {
                    current: displayIndex + 1,
                    total,
                  })}
                </>
              ) : (
                <>{displayIndex + 1} / {total} · ✓ {correct} ✗ {wrong}</>
              )}
            </span>
            <HelpNavLink />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <details
          className="mb-6 w-full rounded border border-stone-200 bg-white px-3 py-2"
          open={exerciseSetupOpen}
          onToggle={(e) => setExerciseSetupOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-stone-700 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2">
            {t("practice.exerciseSetup")}
          </summary>
          <div className="mt-3 space-y-4">
            {repeatMistakesMode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                {t("practice.repeatMistakesLeft", { count: list.length })}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm text-stone-600">{t("practice.askFor")}</span>
                <select
                  value={promptMode}
                  onChange={(e) =>
                    setPromptMode(e.target.value as "description" | "explanation")
                  }
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
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
                    if (v === "flashcard") {
                      setPromptMode("explanation");
                    }
                  }}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                >
                  <option value="straight">{t("practice.straightAnswer")}</option>
                  <option value="multiple-choice">{t("practice.multipleChoice")}</option>
                  <option value="flashcard">{t("practice.flashcard")}</option>
                </select>
              </label>
              {mode === "flashcard" ? (
                <>
                  <fieldset className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <legend className="sr-only">{t("practice.flashcardWhichCards")}</legend>
                    <span className="text-sm text-stone-600">{t("practice.flashcardWhichCards")}</span>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="flashcard-filter"
                        checked={flashcardCardFilter === "all"}
                        onChange={() => setFlashcardCardFilter("all")}
                        className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                      />
                      <span className="text-sm text-stone-700">{t("practice.flashcardAllCards")}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="flashcard-filter"
                        checked={flashcardCardFilter === "unknown"}
                        onChange={() => setFlashcardCardFilter("unknown")}
                        className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                      />
                      <span className="text-sm text-stone-700">{t("practice.flashcardUnknownOnly")}</span>
                    </label>
                    {deck && deck.items.length > 0 ? (
                      <span
                        key={`known-stat-${knownUiBump}`}
                        className="text-xs text-stone-500"
                      >
                        {t("practice.flashcardKnownCount", {
                          known: countKnownInDeck(
                            id,
                            deck.items.map((it) => it.id)
                          ),
                          total: deck.items.length,
                        })}
                      </span>
                    ) : null}
                  </fieldset>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={flashcardBrowseOnly}
                      onChange={(e) => setFlashcardBrowseOnly(e.target.checked)}
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    <span className="text-sm text-stone-700">
                      {t("practice.flashcardBrowseOnly")}
                    </span>
                  </label>
                  <p className="w-full text-xs text-stone-500 sm:max-w-xl">
                    {flashcardBrowseOnly
                      ? t("practice.flashcardBrowseHint")
                      : t("practice.flashcardFormatHint")}
                  </p>
                </>
              ) : null}
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
            (isSpeechRecognitionSupported() || cloudSttAvailable) &&
            !(mode === "flashcard" && flashcardBrowseOnly) && (
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
          {mode === "flashcard" && speakMode && !flashcardBrowseOnly && (
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-stone-600">{t("practice.flashcardSttEngine")}</span>
              <select
                value={flashcardSttEngine}
                onChange={(e) => {
                  const v = e.target.value as "google" | "browser";
                  setFlashcardSttEngine(v);
                  localStorage.setItem("pstudy-flashcard-stt", v);
                }}
                className="rounded border border-stone-300 bg-white px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                <option value="google">{t("practice.flashcardSttGoogle")}</option>
                <option value="browser">{t("practice.flashcardSttBrowser")}</option>
              </select>
              {!cloudSttAvailable && flashcardSttEngine === "google" ? (
                <span className="w-full text-xs text-amber-700">
                  {t("practice.flashcardSttGoogleUnavailable")}
                </span>
              ) : null}
            </label>
          )}
          {(mode === "straight" || mode === "flashcard") &&
            speakMode &&
            !(mode === "flashcard" && flashcardBrowseOnly) &&
            !(mode === "straight" && vocabularyBias) && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={showSttHeardDebug}
                onChange={(e) => setShowSttHeardDebug(e.target.checked)}
                className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
              />
              <span className="text-sm text-stone-500">{t("practice.showSttHeardDebug")}</span>
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
          {mode === "straight" && speakMode && (
            <details
              className="mt-3 w-full rounded border border-stone-200 bg-stone-50/90 px-3 py-2"
              onToggle={(e) => {
                setSpeechMappingPanelOpen((e.currentTarget as HTMLDetailsElement).open);
              }}
            >
              <summary className="cursor-pointer select-none text-sm font-medium text-stone-700">
                {t("practice.deckSttAliasesSummary")}
              </summary>
              <p className="mt-2 text-xs text-amber-800/90">{t("practice.deckSttAliasesPausesExercise")}</p>
              <p className="mt-2 text-xs text-stone-500">{t("practice.deckSttAliasesHint")}</p>
              <div className="mt-3 space-y-2">
                {sttAliasRows.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={row.from}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSttAliasRows((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, from: v } : r))
                        );
                      }}
                      placeholder={t("practice.deckSttAliasesHeardPlaceholder")}
                      className="min-w-[8rem] flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
                      aria-label={t("practice.deckSttAliasesHeardPlaceholder")}
                    />
                    <span className="text-stone-400" aria-hidden>
                      →
                    </span>
                    <select
                      value={row.to}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSttAliasRows((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, to: v } : r))
                        );
                      }}
                      className="min-w-[6rem] flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
                      aria-label={t("practice.deckSttAliasesPickAnswer")}
                    >
                      <option value="">{t("practice.deckSttAliasesPickAnswer")}</option>
                      {deckAnswerVocabulary.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setSttAliasRows((rows) => rows.filter((_, j) => j !== i))
                      }
                      className="rounded px-2 py-1 text-xs text-stone-500 hover:bg-stone-200"
                    >
                      {t("common.remove")}
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSttAliasRows((rows) => [...rows, { from: "", to: "" }])
                    }
                    className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                  >
                    {t("practice.deckSttAliasesAdd")}
                  </button>
                  {lastHeardRaw.trim() ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSttAliasRows((rows) => [
                          ...rows,
                          { from: lastHeardRaw.trim(), to: "" },
                        ])
                      }
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-stone-800 hover:bg-amber-100"
                    >
                      {t("practice.deckSttAliasesFromLastHeard")}
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          )}
            </div>
          </div>
        </details>

        {mode === "flashcard" ? (
          <div className="card mb-6">
            {activeCard.instruction ? (
              <p className="text-sm text-stone-500">{activeCard.instruction}</p>
            ) : null}
            <div className="flashcard-3d-scene mx-auto mt-4 max-w-xl">
              <div
                className="flashcard-3d-inner"
                data-flipped={flashcardRevealed ? "true" : "false"}
              >
                <div className="flashcard-3d-face absolute inset-0 flex flex-col overflow-hidden rounded-2xl border-2 border-stone-300 bg-gradient-to-br from-amber-50 via-white to-amber-100/80 shadow-[0_10px_40px_rgba(0,0,0,0.12)]">
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                        {t("practice.flashcardFrontLabel")}
                      </p>
                      <button
                        type="button"
                        onClick={handleListenQuestion}
                        className="shrink-0 rounded-lg border border-stone-300/80 bg-white/80 px-2.5 py-1 text-xs text-stone-600 transition hover:border-pstudy-primary hover:text-pstudy-primary"
                        title={t("practice.listenToQuestion")}
                      >
                        {t("common.listen")}
                      </button>
                    </div>
                    {activeCard.picture_url ? (
                      <div className="mt-2 flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          key={`fc:${displayIndex}:${activeCard.id}:${activeCard.picture_url}`}
                          src={activeCard.picture_url}
                          alt=""
                          className="max-h-36 w-full rounded-lg object-contain ring-1 ring-stone-200/80"
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-1 items-center justify-center">
                      <p className="text-center text-xl font-semibold leading-snug text-stone-900">
                        {visibleSideText.trim() || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flashcard-3d-face flashcard-3d-back absolute inset-0 flex flex-col overflow-hidden rounded-2xl border-2 border-teal-700/25 bg-gradient-to-br from-white via-teal-50/50 to-emerald-50/70 shadow-[0_10px_40px_rgba(0,0,0,0.12)]">
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
                    <p className="text-center text-xs font-semibold uppercase tracking-wider text-teal-800/85">
                      {t("practice.flashcardBackLabel")}
                    </p>
                    <div className="mt-3">
                      <FlashcardRevealedView
                        text={hiddenSideCorrect}
                        keywordTags={flashcardKeywordTags}
                        compareText={
                          flashcardBrowseOnly ? hiddenSideCorrect : answer
                        }
                        side="official"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card mb-6">
            {activeCard.instruction ? (
              <p className="text-sm text-stone-500">{activeCard.instruction}</p>
            ) : null}
            <div className="mt-2 flex items-start justify-between gap-2">
              <h2 className="flex-1 text-xl font-semibold text-stone-900">
                {promptMode === "description"
                  ? activeCard.explanation
                  : activeCard.description}
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
            {activeCard.picture_url && (
              <div className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={
                    showResult
                      ? `r:${activeCard.id}:${activeCard.picture_url}`
                      : `i:${displayIndex}:${activeCard.id}:${activeCard.picture_url}`
                  }
                  src={activeCard.picture_url}
                  alt="Item picture"
                  className="max-h-64 w-full rounded-lg object-contain ring-1 ring-stone-200"
                />
              </div>
            )}
          </div>
        )}

        {!showResult ? (
          <>
            {mode === "straight" ? (
              <>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEnterToCheck();
                  }}
                >
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
                      className="min-w-0 flex-1 rounded-lg border border-stone-300 px-4 py-3 text-lg focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                      autoFocus
                      enterKeyHint="done"
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
                  <button
                    type="submit"
                    className="btn-primary w-full touch-manipulation py-3 sm:w-auto sm:px-8"
                  >
                    {t("practice.checkAnswer")}
                  </button>
                </form>
                {speakMode &&
                  (showSttHeardDebug || vocabularyBias || speechMappingPanelOpen) && (
                  <div className="mt-2">
                    <label className="mb-1 block text-xs font-medium text-stone-500">
                      {t("practice.sttHeardRawLabel")}
                    </label>
                    <textarea
                      readOnly
                      rows={2}
                      value={lastHeardRaw}
                      placeholder="—"
                      className="w-full resize-y rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 font-mono text-sm text-stone-800 focus:outline-none"
                    />
                  </div>
                )}
              </>
            ) : mode === "flashcard" ? (
              flashcardBrowseOnly ? (
                <div className="mx-auto w-full max-w-xl space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={prev} className="btn-secondary">
                      {t("common.previous")}
                    </button>
                    {!flashcardRevealed ? (
                      <button
                        type="button"
                        onClick={revealFlashcard}
                        className="btn-primary"
                      >
                        {t("practice.flashcardShowBack")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFlashcardRevealed(false)}
                        className="btn-secondary"
                      >
                        {t("practice.flashcardShowFront")}
                      </button>
                    )}
                    <button type="button" onClick={next} className="btn-primary">
                      {t("common.next")}
                    </button>
                  </div>
                  {flashcardRevealed ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
                      <button
                        type="button"
                        onClick={handleListenAnswer}
                        className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 transition hover:border-pstudy-primary hover:text-pstudy-primary"
                        title={t("practice.listenToAnswer")}
                      >
                        {t("common.listen")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!current) return;
                          const nextKnown = !isItemKnown(id, current.id);
                          setItemKnown(id, current.id, nextKnown);
                          setKnownUiBump((n) => n + 1);
                        }}
                        className="btn-secondary"
                      >
                        {isItemKnown(id, current.id)
                          ? t("practice.flashcardMarkUnknown")
                          : t("practice.flashcardMarkKnown")}
                      </button>
                    </div>
                  ) : null}
                  <p className="text-xs text-stone-500">{t("practice.flashcardBrowseKeys")}</p>
                </div>
              ) : (
              <div className="mx-auto w-full max-w-xl space-y-4">
                {!flashcardRevealed ? (
                  <div>
                    <label
                      htmlFor="flashcard-back-input"
                      className="mb-2 block text-sm font-medium text-stone-700"
                    >
                      {t("practice.flashcardTypeBack")}
                    </label>
                    <textarea
                      id="flashcard-back-input"
                      value={answer}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        setAnswer(newVal);
                        if (
                          speakMode &&
                          newVal === "" &&
                          stopListeningRef.current
                        ) {
                          stopListeningRef.current();
                          startSpeakListening();
                        }
                      }}
                      placeholder={t("practice.flashcardYourBackPlaceholder")}
                      className="flashcard-answer-matched w-full rounded-xl border border-stone-300 bg-white px-4 py-3 font-mono text-base leading-relaxed text-stone-800 shadow-sm focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-stone-500">
                      {t("practice.flashcardEnterToFlip")}
                    </p>
                  </div>
                ) : (
                  <div className="flashcard-answer-matched flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                    <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {t("practice.flashcardYourAnswerLabel")}
                    </p>
                    <div className="mt-2 min-h-0 flex-1 overflow-y-auto text-stone-800">
                      {answer.trim() ? (
                        <FlashcardRevealedView
                          text={answer}
                          keywordTags={flashcardKeywordTags}
                          compareText={hiddenSideCorrect}
                          side="user"
                        />
                      ) : (
                        <span className="font-mono text-lg text-stone-400">—</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {speakMode && !flashcardRevealed && (
                    <span
                      className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm ${
                        isListening
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-stone-100 text-stone-500"
                      }`}
                      title={
                        isListening
                          ? t("practice.flashcardListeningHint")
                          : t("practice.speakOn")
                      }
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {isListening ? t("practice.listening") : t("practice.speakOn")}
                    </span>
                  )}
                  {speakMode && showSttHeardDebug && !flashcardRevealed && (
                    <div className="mt-1 w-full min-w-[12rem]">
                      <label className="mb-1 block text-xs font-medium text-stone-500">
                        {t("practice.sttHeardRawLabel")}
                      </label>
                      <textarea
                        readOnly
                        rows={2}
                        value={lastHeardRaw}
                        placeholder="—"
                        className="w-full max-w-xl resize-y rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 font-mono text-sm text-stone-800 focus:outline-none"
                      />
                    </div>
                  )}
                  {!flashcardRevealed ? (
                    <button
                      type="button"
                      onClick={revealFlashcard}
                      className="btn-primary"
                    >
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
                      <button
                        type="button"
                        onClick={() => {
                          if (!current) return;
                          const nextKnown = !isItemKnown(id, current.id);
                          setItemKnown(id, current.id, nextKnown);
                          setKnownUiBump((n) => n + 1);
                        }}
                        className="btn-secondary"
                      >
                        {isItemKnown(id, current.id)
                          ? t("practice.flashcardMarkUnknown")
                          : t("practice.flashcardMarkKnown")}
                      </button>
                      <button type="button" onClick={next} className="btn-primary">
                        {t("common.next")}
                      </button>
                    </>
                  )}
                </div>
              </div>
              )
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-stone-600">{t("practice.mcSelectThenConfirm")}</p>
                {mcOptions.map((opt) => {
                  const selected = answer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(opt)}
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        selected
                          ? "border-pstudy-primary bg-teal-50 ring-2 ring-pstudy-primary/30"
                          : "border-stone-300 bg-white hover:border-pstudy-primary hover:bg-teal-50/60"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleEnterToCheck()}
                  disabled={!answer.trim()}
                  className="btn-primary w-full touch-manipulation py-3 sm:w-auto sm:px-8 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("practice.checkAnswer")}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
          <div
            className={`rounded-lg border-2 p-4 ${
                normalizeAnswer(answer) ===
                normalizeAnswer(
                  promptMode === "description"
                    ? activeCard.description
                    : activeCard.explanation
                )
                  ? "border-green-500 bg-green-50"
                  : "border-red-400 bg-red-50"
              }`}
            >
              <p className="font-medium">
                {normalizeAnswer(answer) ===
                normalizeAnswer(
                  promptMode === "description"
                    ? activeCard.description
                    : activeCard.explanation
                )
                  ? t("common.correct")
                  : t("common.incorrect")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-stone-700">
                <span>
                  {t("common.answer")}:{" "}
                  <strong>
                    {promptMode === "description"
                      ? activeCard.description
                      : activeCard.explanation}
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
            <button
              ref={practiceResultNextRef}
              type="button"
              onClick={next}
              className="btn-primary"
            >
              {repeatMistakesMode
                ? list.length <= 1
                  ? t("practice.seeResults")
                  : t("common.next")
                : displayIndex + 1 >= total
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
