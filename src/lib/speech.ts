/**
 * Web Speech API utilities for TTS and speech recognition.
 * TTS: Chrome, Edge, Safari, Firefox
 * Speech Recognition: Chrome, Edge (not Firefox, Safari)
 */

import { normalizeSpeechLocale } from "@/lib/speech-locale";

/** Chrome often leaves speechSynthesis "paused" until resume(); call before speak/sr. */
export function prepareSpeechSynthesis(): void {
  if (typeof window === "undefined") return;
  try {
    const s = window.speechSynthesis;
    if (s.paused) s.resume();
  } catch {
    // ignore
  }
}

function runWhenVoicesReady(run: () => void): void {
  if (typeof window === "undefined") return;
  const s = window.speechSynthesis;
  prepareSpeechSynthesis();
  if (s.getVoices().length > 0) {
    run();
    return;
  }
  const onVoices = () => {
    s.removeEventListener("voiceschanged", onVoices);
    run();
  };
  s.addEventListener("voiceschanged", onVoices);
  window.setTimeout(() => {
    s.removeEventListener("voiceschanged", onVoices);
    run();
  }, 600);
}

/** Speak text using the browser's built-in TTS */
export function speak(text: string, lang = "en"): void {
  if (typeof window === "undefined" || !text?.trim()) return;
  runWhenVoicesReady(() => {
    prepareSpeechSynthesis();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = normalizeSpeechLocale(lang);
    utterance.rate = 0.9;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
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
  runWhenVoicesReady(() => {
    prepareSpeechSynthesis();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = normalizeSpeechLocale(lang);
    utterance.rate = 0.9;
    utterance.volume = 1;
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

/** Stop any ongoing speech */
export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.;:!?]+$/g, "");
}

/** Strip leading/trailing punctuation from a single token (STT often returns "do." or "sol,"). */
function cleanSpeechToken(raw: string): string {
  return raw.replace(/^[''".,;:!?]+|[''".,;:!?]+$/g, "").trim().toLowerCase();
}

/** Common speech recognition mishearings for solfège (do, re, mi, fa, sol, la, si). */
const SOLFEGE_MISHEARINGS: Record<string, string> = {
  doe: "do", dough: "do", due: "do", doh: "do",
  ray: "re", rei: "re", rey: "re",
  me: "mi", my: "mi", mee: "mi",
  far: "fa", faa: "fa",
  soul: "sol",
  soulful: "sol",
  so: "sol",
  sew: "sol",
  sow: "sol",
  sawl: "sol",
  saul: "sol",
  sole: "sol",
  law: "la", lah: "la", laa: "la",
  see: "si", sea: "si", c: "si", tea: "ti", tee: "ti", ti: "si",
};

/**
 * Tokens often wrongly inserted by English STT when learning single syllables; never map these to notes.
 */
const DECK_ONLY_IGNORE_TOKENS = new Set([
  "to", "two", "too", "the", "a", "an", "oh", "uh", "um", "hmm",
  "is", "it", "if", "of", "or", "be", "we", "he", "go", "no",
  "my", "hi", "by", "up", "in", "on", "at", "as", "am", "us",
  "and", "are", "but", "not", "you", "all", "can", "had", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "its", "may", "new", "now", "old", "way", "who", "boy",
  "did", "let", "put", "say", "she", "use",
]);

function findClosestVocabMatch(transcript: string, vocab: string[]): string | null {
  const t = normalizeForMatch(transcript);
  if (!t) return null;
  let best: string | null = null;
  let bestDist = Math.min(4, Math.ceil(t.length * 0.5) + 1);
  for (const v of vocab) {
    const vn = normalizeForMatch(v);
    if (!vn) continue;
    if (t === vn) return v;
    // Avoid mapping junk like "to" → "do": no fuzzy match when either side is ≤2 chars (use solfège table).
    if (Math.min(t.length, vn.length) <= 2) continue;
    const dist = levenshtein(t, vn);
    const maxAllowed =
      Math.min(t.length, vn.length) <= 3 ? 2 : Math.max(2, Math.ceil(Math.min(t.length, vn.length) * 0.45));
    if (dist <= maxAllowed && dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

/** Stricter fuzzy match for longer tokens only (deck-only path). */
function findClosestVocabMatchLongTokens(transcript: string, vocab: string[]): string | null {
  const t = normalizeForMatch(transcript);
  if (!t || t.length < 3) return null;
  let best: string | null = null;
  let bestDist = 99;
  for (const v of vocab) {
    const vn = normalizeForMatch(v);
    if (!vn) continue;
    if (t === vn) return v;
    if (Math.abs(t.length - vn.length) > 3) continue;
    const dist = levenshtein(t, vn);
    const maxAllowed = Math.max(1, Math.floor(Math.min(t.length, vn.length) * 0.4));
    if (dist <= maxAllowed && dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return best;
}

/**
 * One 2-letter edit with same first letter (e.g. "ro"→"re"), but never "to"→"do".
 * Only if exactly one deck answer of length 2 matches.
 */
function resolveTwoCharNoteFuzzy(token: string, vocabulary: string[]): string | null {
  if (token.length !== 2 || DECK_ONLY_IGNORE_TOKENS.has(token)) return null;
  const matches: string[] = [];
  for (const v of vocabulary) {
    const vn = normalizeForMatch(v);
    if (vn.length !== 2) continue;
    if (token[0] !== vn[0]) continue;
    if (levenshtein(token, vn) > 1) continue;
    matches.push(v);
  }
  return matches.length === 1 ? matches[0]! : null;
}

/**
 * When "Consider only deck answers" is on: keep only tokens that can be tied to the deck
 * vocabulary (exact, solfège aliases, or fuzzy for longer words). Google phrase hints are not a grammar —
 * this is the real constraint. Returns null if nothing in the transcript matches (ignored).
 */
export function resolveDeckOnlyTranscript(transcript: string, vocabulary: string[]): string | null {
  if (!vocabulary.length) return null;

  const vocabNormToCanon = new Map<string, string>();
  for (const v of vocabulary) {
    const n = normalizeForMatch(v);
    if (n) vocabNormToCanon.set(n, v);
  }
  const line = normalizeForMatch(transcript);
  if (!line) return null;

  if (vocabNormToCanon.has(line)) {
    return vocabNormToCanon.get(line)!;
  }

  const extracted = extractVocabMatches(line, vocabulary);
  if (extracted) {
    return extracted;
  }

  const wholeFuzzy = findClosestVocabMatch(line, vocabulary);
  if (wholeFuzzy) {
    return wholeFuzzy;
  }

  const tokens = line.split(/\s+/).map((w) => cleanSpeechToken(w)).filter(Boolean);
  const out: string[] = [];
  const needsFuzzy: string[] = [];

  for (const token of tokens) {
    if (!token) continue;
    if (vocabNormToCanon.has(token)) {
      out.push(vocabNormToCanon.get(token)!);
      continue;
    }
    const sol = SOLFEGE_MISHEARINGS[token];
    if (sol) {
      const canon = vocabNormToCanon.get(normalizeForMatch(sol));
      if (canon) {
        out.push(canon);
        continue;
      }
    }
    if (DECK_ONLY_IGNORE_TOKENS.has(token)) continue;
    needsFuzzy.push(token);
  }

  if (needsFuzzy.length === 0) {
    return out.length ? out.join(" ") : null;
  }

  // Multiple unknown tokens: keep any exact matches already in `out` (e.g. "ice cream texas" → Texas).
  // If nothing yet, try matching the joined tokens ("north" + "dakota") — token cleaners often fix
  // commas/punct that still break whole-line fuzzy on the raw `line` (e.g. "North, Dakota").
  if (needsFuzzy.length > 1) {
    if (out.length > 0) {
      return out.join(" ");
    }
    const combo = findClosestVocabMatch(needsFuzzy.join(" "), vocabulary);
    if (combo) {
      return combo;
    }
    return null;
  }

  const u = needsFuzzy[0]!;
  let fuzzyPick: string | null = null;
  if (u.length === 2) {
    fuzzyPick = resolveTwoCharNoteFuzzy(u, vocabulary);
  } else if (u.length >= 3) {
    fuzzyPick = findClosestVocabMatchLongTokens(u, vocabulary);
  }
  if (!fuzzyPick) {
    return out.length ? out.join(" ") : null;
  }
  out.push(fuzzyPick);
  return out.join(" ");
}

/**
 * Map solfège mishearings only when every token resolves to deck vocabulary.
 * Partial matches (e.g. dropping "soulful" and keeping only "mi") made recognition worse than full-path fuzzy/extract.
 */
function mapSolfègeMishearings(transcript: string, vocab: string[]): string | null {
  const vocabByNorm = new Map(vocab.map((v) => [normalizeForMatch(v), v]));
  const t = normalizeForMatch(transcript);
  const words = t.split(/\s+/).map((w) => cleanSpeechToken(w)).filter(Boolean);
  if (words.length === 0) return null;

  const tOne = cleanSpeechToken(t.replace(/\s+/g, " ").trim());
  const direct = SOLFEGE_MISHEARINGS[t] ?? SOLFEGE_MISHEARINGS[tOne];
  if (words.length === 1 && direct) {
    const canonical = vocabByNorm.get(normalizeForMatch(direct));
    if (canonical) return canonical;
  }

  const out: string[] = [];
  for (const w of words) {
    const mappedKey = SOLFEGE_MISHEARINGS[w] ?? w;
    const canonical = vocabByNorm.get(normalizeForMatch(mappedKey));
    if (!canonical) return null;
    out.push(canonical);
  }
  return out.join(" ");
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
  recognition.lang = normalizeSpeechLocale(options.lang || "en");
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
    const vocab = options.vocabulary!;
    for (const t of raw) {
      if (vocabSet.has(normalizeForMatch(t))) return t;
    }
    if (vocabularyOnly) {
      for (const t of raw) {
        const resolved = resolveDeckOnlyTranscript(t, vocab);
        if (resolved) return resolved;
      }
    }
    for (const t of raw) {
      const mapped = mapSolfègeMishearings(t, vocab);
      if (mapped) return mapped;
    }
    for (const t of raw) {
      const best = findClosestVocabMatch(t, vocab);
      if (best) return best;
    }
    for (const t of raw) {
      const extracted = extractVocabMatches(t, vocab);
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
