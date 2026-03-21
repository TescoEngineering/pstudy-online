/**
 * Web Speech API utilities for TTS and speech recognition.
 * TTS: Chrome, Edge, Safari, Firefox
 * Speech Recognition: Chrome, Edge (not Firefox, Safari)
 */

/** Speak text using the browser's built-in TTS */
export function speak(text: string, lang = "en"): void {
  if (typeof window === "undefined" || !text?.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Speak text and call onEnd when finished (use to avoid starting mic during TTS) */
export function speakWithCallback(
  text: string,
  onEnd: () => void,
  lang = "en"
): void {
  if (typeof window === "undefined" || !text?.trim()) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.onend = () => onEnd();
  utterance.onerror = () => onEnd();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** Stop any ongoing speech */
export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "");
}

/** Common speech recognition mishearings for solfège (do, re, mi, fa, sol, la, si). */
const SOLFEGE_MISHEARINGS: Record<string, string> = {
  doe: "do", dough: "do", due: "do", doh: "do",
  ray: "re", rei: "re",
  me: "mi", my: "mi",
  far: "fa", faa: "fa",
  soul: "sol", so: "sol", sew: "sol", sow: "sol", sawl: "sol", saul: "sol",
  law: "la", lah: "la", laa: "la",
  see: "si", sea: "si", c: "si", tea: "ti", tee: "ti", ti: "si",
};

function findClosestVocabMatch(transcript: string, vocab: string[]): string | null {
  const t = normalizeForMatch(transcript);
  if (!t) return null;
  let best: string | null = null;
  let bestDist = Math.min(4, Math.ceil(t.length * 0.5) + 1);
  for (const v of vocab) {
    const vn = normalizeForMatch(v);
    if (!vn) continue;
    if (t === vn) return v;
    const dist = levenshtein(t, vn);
    // More lenient for short words (do, re, mi, fa, la, si): allow up to 2 edits
    const maxAllowed =
      Math.min(t.length, vn.length) <= 3 ? 2 : Math.max(2, Math.ceil(Math.min(t.length, vn.length) * 0.45));
    if (dist <= maxAllowed && dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

/** Map common speech mishearings (e.g. "soul"->"sol") when vocab contains solfège notes. */
function mapSolfègeMishearings(transcript: string, vocab: string[]): string | null {
  const vocabByNorm = new Map(vocab.map((v) => [normalizeForMatch(v), v]));
  const t = normalizeForMatch(transcript);
  const direct = SOLFEGE_MISHEARINGS[t];
  if (direct) {
    const canonical = vocabByNorm.get(normalizeForMatch(direct));
    if (canonical) return canonical;
  }
  const words = t.split(/\s+/);
  const mapped = words
    .map((w) => SOLFEGE_MISHEARINGS[w] ?? w)
    .map((w) => vocabByNorm.get(normalizeForMatch(w)))
    .filter((v): v is string => !!v);
  return mapped.length > 0 ? mapped.join(" ") : null;
}

/** Extract vocabulary matches from transcript (e.g. "Texas Arizona" when both are in vocab). */
function extractVocabMatches(transcript: string, vocab: string[]): string {
  const t = normalizeForMatch(transcript);
  if (!t) return "";
  const vocabSorted = [...vocab]
    .filter((v) => normalizeForMatch(v).length > 0)
    .sort((a, b) => normalizeForMatch(b).length - normalizeForMatch(a).length);
  const result: string[] = [];
  let i = 0;
  while (i < t.length) {
    while (i < t.length && t[i] === " ") i++;
    if (i >= t.length) break;
    let matched = false;
    for (const v of vocabSorted) {
      const vn = normalizeForMatch(v);
      if (vn && t.slice(i, i + vn.length) === vn && (i + vn.length === t.length || t[i + vn.length] === " ")) {
        result.push(v);
        i += vn.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const nextSpace = t.indexOf(" ", i);
      i = nextSpace >= 0 ? nextSpace + 1 : t.length;
    }
  }
  return result.join(" ").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
    }
  }
  return d[m][n];
}

/** Check if speech recognition is supported (Chrome, Edge) */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

type SpeechRecognitionOptions = {
  lang?: string;
  continuous?: boolean;
  /** Vocabulary of expected answers. When provided, we request multiple alternatives and pick the best match. Client-side only. */
  vocabulary?: string[];
  /** When true with vocabulary: only accept transcripts that match the vocabulary. Ignore non-matches. */
  vocabularyOnly?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  /** Called when recognition ends (Chrome stops after ~60s). Use to restart for continuous listening. */
  onEnd?: () => void;
};

/** Start listening and transcribe speech to text. Set continuous=true to keep listening until stop(). */
export function startListening(options: SpeechRecognitionOptions): (() => void) | null {
  if (typeof window === "undefined") return null;
  const SpeechRecognition =
    (window as Window & { SpeechRecognition?: new () => SpeechRecognitionInstance })
      .SpeechRecognition ||
    (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
      .webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.continuous ?? false;
  recognition.lang = options.lang || "en";
  const hasVocabulary = (options.vocabulary?.length ?? 0) > 0;
  recognition.maxAlternatives = hasVocabulary ? 5 : 1;

  const vocabSet = hasVocabulary
    ? new Set(options.vocabulary!.map((v) => normalizeForMatch(v)))
    : null;

  const vocabularyOnly = options.vocabularyOnly ?? false;

  function pickBestTranscript(alternatives: Array<{ transcript?: string }>, _isFinal: boolean): string {
    if (!alternatives?.length) return "";
    const raw = alternatives.map((a) => String(a.transcript ?? "").trim()).filter(Boolean);
    if (!raw.length) return "";
    if (!vocabSet) return vocabularyOnly ? "" : raw[0];
    for (const t of raw) {
      if (vocabSet.has(normalizeForMatch(t))) return t;
    }
    for (const t of raw) {
      const mapped = mapSolfègeMishearings(t, options.vocabulary!);
      if (mapped) return mapped;
    }
    for (const t of raw) {
      const best = findClosestVocabMatch(t, options.vocabulary!);
      if (best) return best;
    }
    for (const t of raw) {
      const extracted = extractVocabMatches(t, options.vocabulary!);
      if (extracted) return extracted;
    }
    return vocabularyOnly ? "" : raw[0];
  }

  recognition.onresult = (event: unknown) => {
    const e = event as { results?: { length?: number; [i: number]: { transcript?: string }; isFinal?: boolean }[] };
    const results = e?.results;
    if (!results || results.length === 0) return;
    const lastIdx = results.length - 1;
    const last = results[lastIdx] as { length?: number; isFinal?: boolean; [i: number]: { transcript?: string } };
    const len = Math.max(1, Number(last?.length) || 1);
    const alternatives: Array<{ transcript?: string }> = [];
    for (let i = 0; i < len; i++) {
      const alt = (last as Record<number, { transcript?: string }>)?.[i];
      if (alt && typeof alt === "object") alternatives.push(alt);
    }
    if (alternatives.length === 0) {
      const first = (last as Record<number, { transcript?: string }>)?.[0];
      if (first) alternatives.push(first);
    }
    const isFinal = last?.isFinal ?? true;
    const transcript = pickBestTranscript(alternatives, isFinal);
    if (transcript) {
      options.onResult(transcript, isFinal);
    }
  };

  recognition.onerror = (event: { error: string }) => {
    if (event.error === "aborted") return;
    const msg =
      event.error === "not-allowed"
        ? "Microphone access denied."
        : event.error === "no-speech"
          ? "No speech detected."
          : `Speech recognition error: ${event.error}`;
    options.onError?.(msg);
  };

  let stopped = false;
  recognition.onend = () => {
    if (!stopped && options.onEnd) options.onEnd();
  };

  try {
    recognition.start();
  } catch (err) {
    options.onError?.("Failed to start speech recognition.");
    return null;
  }

  return () => {
    stopped = true;
    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
