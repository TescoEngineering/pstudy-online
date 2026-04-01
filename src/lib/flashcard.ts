/**
 * Flashcard mode: skeleton of explanation, fill in by speaking matching words.
 * Supports multiline answers and lines starting with - * or • as bullets (gaps + reveal).
 */

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, "");
}

/** Strip leading markdown-style bullet from a line (for word gaps; bullet not a “word”). */
const BULLET_PREFIX = /^\s*[-*•]\s*/;

/** Split explanation into words (preserve punctuation, flatten lines) */
export function getExplanationWords(explanation: string): string[] {
  return String(explanation ?? "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

export type FlashcardLineMeta = {
  words: string[];
  /**
   * After these word indices (inclusive), the next word starts a new line in the gap display.
   * Example: breaksAfter [1] for two words on first line, then newline before third word.
   */
  breaksAfter: number[];
};

/**
 * Split explanation into lines; each non-empty line contributes words.
 * Lines starting with `-`, `*`, or `•` strip the marker (optional space after it) for gap matching.
 */
export function getFlashcardLineMeta(explanation: string): FlashcardLineMeta {
  const words: string[] = [];
  const breaksAfter: number[] = [];
  const raw = String(explanation ?? "");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const content = trimmed.replace(BULLET_PREFIX, "");
    const lineWords = content.split(/\s+/).filter((w) => w.length > 0);
    for (const w of lineWords) {
      words.push(w);
    }
    if (lineWords.length > 0) {
      breaksAfter.push(words.length - 1);
    }
  }

  return { words, breaksAfter };
}

/** Build gap display with newlines between lines (same word/filled indices as getFlashcardLineMeta). */
export function buildFlashcardDisplayMultiline(
  words: string[],
  filled: (string | null)[],
  breaksAfter: number[]
): string {
  if (words.length === 0) return "";
  const breakSet = new Set(breaksAfter);
  let out = "";
  for (let i = 0; i < words.length; i++) {
    if (i > 0) {
      out += breakSet.has(i - 1) ? "\n" : " ";
    }
    const slot =
      filled[i] != null ? String(filled[i]) : "_".repeat(Math.max(1, words[i]?.length ?? 1));
    out += slot;
  }
  return out;
}

/** @deprecated Use buildFlashcardDisplayMultiline with getFlashcardLineMeta for multi-line cards. */
export function buildFlashcardDisplay(
  words: string[],
  filled: (string | null)[]
): string {
  return words
    .map((w, i) => (filled[i] !== null ? filled[i] : "_".repeat(w.length)))
    .join(" ");
}

/** Match transcript words to explanation and update filled slots. Returns new filled array. */
export function fillFromTranscript(
  transcript: string,
  words: string[],
  filled: (string | null)[]
): (string | null)[] {
  const normalizedWords = words.map((w) => normalize(w));
  const transcriptWords = transcript
    .split(/\s+/)
    .map((w) => normalize(w))
    .filter(Boolean);
  const next = [...filled];

  for (const tw of transcriptWords) {
    if (!tw) continue;
    for (let i = 0; i < words.length; i++) {
      if (next[i] !== null) continue;
      if (normalizedWords[i] === tw) {
        next[i] = words[i];
        break;
      }
    }
  }
  return next;
}

/** Check if all slots are filled */
export function isComplete(filled: (string | null)[]): boolean {
  return filled.length > 0 && filled.every((f) => f !== null);
}

export type FlashcardRevealSegment =
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string };

/** Parse explanation for revealed flashcard: bullets vs plain paragraphs. */
export function parseFlashcardRevealSegments(explanation: string): FlashcardRevealSegment[] {
  const lines = String(explanation ?? "").split(/\r?\n/);
  const out: FlashcardRevealSegment[] = [];
  for (const line of lines) {
    // Optional space after the marker so "-item" and "- item" both work (typed answers).
    const m = line.match(/^\s*[-*•]\s*(.*)$/);
    if (m) {
      const text = m[1].trim();
      if (text) out.push({ type: "bullet", text });
    } else if (line.trim()) {
      out.push({ type: "paragraph", text: line.trim() });
    }
  }
  return out;
}

/** Keywords field: split on comma or semicolon. */
export function splitKeywordTags(raw: string): string[] {
  return String(raw ?? "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Tags used for regex highlighting. Single-character tags are skipped: a lone letter like "t"
 * matches every occurrence in text and is almost always accidental (e.g. from “add words”).
 */
export function keywordTagsEligibleForHighlight(tags: readonly string[]): string[] {
  return tags.map((k) => k.trim()).filter((k) => k.length >= 2);
}

export function splitKeywordTagsForHighlight(raw: string): string[] {
  return keywordTagsEligibleForHighlight(splitKeywordTags(raw));
}
