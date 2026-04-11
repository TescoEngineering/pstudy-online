/**
 * Flashcard mode: skeleton of explanation, fill in by speaking matching words.
 * Supports multiline answers and lines starting with - * or • as bullets (gaps + reveal).
 */

import { normalizeLenientAnswer } from "@/lib/exam-validation";

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

/** One segment of a cloze line: plain text or a masked keyword from the card’s keyword tags. */
export type KeywordClozePart =
  | { type: "text"; value: string }
  | { type: "gap"; keyword: string };

/**
 * Split a single line into text and keyword-shaped gaps (for “say/type the full line” cloze).
 * Uses the same length rule as highlighting: tags shorter than 2 characters are ignored.
 */
export function splitLineForKeywordCloze(
  line: string,
  keywordTags: readonly string[]
): KeywordClozePart[] {
  const terms = keywordTagsEligibleForHighlight([...keywordTags]);
  if (!line) return [];
  if (terms.length === 0) {
    return [{ type: "text", value: line }];
  }
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const rawParts = line.split(re);
  const out: KeywordClozePart[] = [];
  for (const part of rawParts) {
    if (!part) continue;
    const kw = sorted.find((k) => part.toLowerCase() === k.toLowerCase());
    if (kw) out.push({ type: "gap", keyword: kw });
    else out.push({ type: "text", value: part });
  }
  return out;
}

/** Placeholder segments in the answer field for gaps (speech should fill canonical answer). */
export const KEYWORD_CLOZE_GAP_MARKER = "___";

/**
 * Build initial answer text for keyword-cloze straight practice: literal segments from the card
 * with `KEYWORD_CLOZE_GAP_MARKER` where keyword tags mask (same layout as bullets/lines).
 */
export function buildKeywordClozeScaffoldAnswerText(
  answerText: string,
  rawKeywords: string
): string {
  const tags = splitKeywordTagsForHighlight(rawKeywords);
  const raw = String(answerText ?? "").trim();
  if (!tags.length || !raw) return "";

  const lineScaffold = (line: string): string => {
    const parts = splitLineForKeywordCloze(line, tags);
    return parts.map((p) => (p.type === "text" ? p.value : KEYWORD_CLOZE_GAP_MARKER)).join("");
  };

  const segs = parseFlashcardRevealSegments(raw);
  if (segs.length === 0) return lineScaffold(raw);

  const lines: string[] = [];
  for (const s of segs) {
    if (s.type === "bullet") lines.push("- " + lineScaffold(s.text));
    else lines.push(lineScaffold(s.text));
  }
  return lines.join("\n");
}

function normalizeKeywordClozeLoose(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function collectKeywordClozeLiteralChunks(
  answerText: string,
  rawKeywords: string
): string[] {
  const tags = splitKeywordTagsForHighlight(rawKeywords);
  const raw = String(answerText ?? "").trim();
  if (!tags.length || !raw) return [];
  const chunks: string[] = [];
  const walk = (line: string) => {
    for (const p of splitLineForKeywordCloze(line, tags)) {
      if (p.type === "text" && p.value.trim()) chunks.push(p.value);
    }
  };
  const segs = parseFlashcardRevealSegments(raw);
  if (segs.length === 0) walk(raw);
  else {
    for (const s of segs) walk(s.type === "bullet" ? s.text : s.text);
  }
  return chunks;
}

/** True if `chunk` is only punctuation (optional in spoken transcript). */
function isPunctuationOnlyChunk(chunk: string): boolean {
  const t = chunk.trim();
  return t.length > 0 && /^[.,;:!?…]+$/u.test(t);
}

/**
 * Append a new final STT segment to prior accumulated speech. Handles engines that emit one
 * final per sentence vs. a longer cumulative final, so multi-sentence answers can be built up.
 */
export function appendSpeechTranscriptChunk(prevAccum: string, piece: string): string {
  const a = prevAccum.trim();
  const b = piece.trim();
  if (!b) return a;
  if (!a) return b;
  if (b === a) return a;
  if (b.startsWith(a)) return b;
  if (a.startsWith(b)) return a;
  const collapse = (s: string) => s.replace(/\s+/gu, " ").trim();
  const ca = collapse(a);
  const cb = collapse(b);
  if (cb.startsWith(ca)) return b;
  if (ca.startsWith(cb)) return a;
  const needSpace =
    !/\s$/u.test(a) &&
    !/^\s/u.test(b) &&
    !/^[,.;:!?]/u.test(b) &&
    !/[-—–]$/u.test(a);
  return needSpace ? `${a} ${b}` : `${a}${b}`;
}

/**
 * One speakable sentence (or single-line) slice of the expected answer for progressive cloze.
 */
export type KeywordClozeSpeechUnit = {
  official: string;
  scaffold: string;
  keywordsCsv: string;
  /** Prefix before this unit: "", space, newline + optional bullet. */
  leading: string;
};

/** Split a paragraph line into sentence-like slices after . ! ? … */
export function splitAnswerIntoSpeechClozeSentences(text: string): string[] {
  const t = String(text ?? "").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?…]+)\s+/u).filter((x) => x.trim().length > 0);
  return parts.length ? parts.map((p) => p.trim()) : [t];
}

function keywordsCsvAppearingInText(sentence: string, rawKeywords: string): string {
  const tags = splitKeywordTagsForHighlight(rawKeywords);
  if (!tags.length) return "";
  const low = sentence.toLowerCase();
  return tags.filter((k) => low.includes(k.toLowerCase())).join(",");
}

/**
 * Flatten the card answer into ordered units, each with official text, scaffold (___ gaps), and
 * which keywords appear in that unit (for per-sentence STT validation).
 */
export function buildKeywordClozeSpeechUnits(
  answerText: string,
  rawKeywords: string
): KeywordClozeSpeechUnit[] {
  const tags = splitKeywordTagsForHighlight(rawKeywords);
  const raw = String(answerText ?? "").trim();
  if (!tags.length || !raw) return [];

  const scaffoldLine = (line: string): string => {
    const parts = splitLineForKeywordCloze(line, tags);
    return parts.map((p) => (p.type === "text" ? p.value : KEYWORD_CLOZE_GAP_MARKER)).join("");
  };

  const units: KeywordClozeSpeechUnit[] = [];
  const segs = parseFlashcardRevealSegments(raw);

  const pushBody = (
    body: string,
    segType: "bullet" | "paragraph",
    newlineBefore: boolean
  ) => {
    const sentences = splitAnswerIntoSpeechClozeSentences(body);
    for (let j = 0; j < sentences.length; j++) {
      const sent = sentences[j]!.trim();
      if (!sent) continue;
      let leading = "";
      if (units.length === 0) {
        leading = segType === "bullet" ? "- " : "";
      } else if (j === 0) {
        leading = (newlineBefore ? "\n" : "") + (segType === "bullet" ? "- " : "");
      } else {
        leading = " ";
      }
      const kws = keywordsCsvAppearingInText(sent, rawKeywords);
      const tagsHere = splitKeywordTagsForHighlight(kws);
      // Sentences with no keyword tags stay visible as hints; only keyword-bearing sentences use ___.
      const scaffold = tagsHere.length > 0 ? scaffoldLine(sent) : sent;
      units.push({
        official: sent,
        scaffold,
        keywordsCsv: kws,
        leading,
      });
    }
  };

  if (segs.length === 0) {
    pushBody(raw, "paragraph", false);
    return units;
  }

  for (let si = 0; si < segs.length; si++) {
    pushBody(
      segs[si]!.text,
      segs[si]!.type === "bullet" ? "bullet" : "paragraph",
      si > 0
    );
  }
  return units;
}

/**
 * Keyword cloze + speech: keep ___ only inside keyword-bearing sentences until validated.
 * Sentences without keywords are always shown in full as hints (same as line-scaffold text).
 *
 * @param currentAnswerBox — optional current field text before this update. When STT sends only
 *   a later sentence, `spokenCombined` may not include earlier sentences; any unit already
 *   validated in the box stays complete (official text), not reverted to scaffold.
 */
export function buildProgressiveKeywordClozeAnswerFromSpeech(
  answerText: string,
  rawKeywords: string,
  spokenCombined: string,
  currentAnswerBox?: string
): string {
  const raw = String(answerText ?? "").trim();
  const spoken = String(spokenCombined ?? "").trim();
  const field = String(currentAnswerBox ?? "").trim();
  const units = buildKeywordClozeSpeechUnits(answerText, rawKeywords);
  if (!units.length) return spoken;

  const fullDone = transcriptCompletesKeywordCloze(spoken, raw, rawKeywords);
  if (fullDone) return fullDone;

  let allMatched = true;
  let out = "";
  for (const u of units) {
    const tagList = splitKeywordTagsForHighlight(u.keywordsCsv);
    let matched = false;
    if (!tagList.length) {
      const no = normalizeLenientAnswer(u.official);
      const ns = normalizeLenientAnswer(spoken);
      const nf = field ? normalizeLenientAnswer(field) : "";
      matched =
        no.length > 0 &&
        (ns.includes(no) || (field.length > 0 && nf.includes(no)));
    } else {
      matched =
        transcriptCompletesKeywordCloze(spoken, u.official, u.keywordsCsv) != null ||
        (field.length > 0 &&
          transcriptCompletesKeywordCloze(field, u.official, u.keywordsCsv) != null);
    }
    if (!matched) allMatched = false;
    out += u.leading + (matched ? u.official : u.scaffold);
  }
  if (allMatched && units.length > 0) return raw;
  return out;
}

/**
 * If the user spoke the full expected answer, return canonical `expected` (card punctuation
 * and capitalization). Otherwise, if **every** keyword for this sentence appears in the transcript
 * (under {@link normalizeLenientAnswer}), accept even when literal wording is not in order —
 * still returns canonical `expected`. Literal chunks are matched in sequence when possible;
 * when a chunk cannot be found but all keywords are already present, the sentence is completed.
 */
export function transcriptCompletesKeywordCloze(
  transcript: string,
  expected: string,
  rawKeywords: string
): string | null {
  const exp = String(expected ?? "").trim();
  const tr = String(transcript ?? "").trim();
  if (!exp || !tr) return null;

  if (normalizeLenientAnswer(tr) === normalizeLenientAnswer(exp)) return exp;

  const tags = splitKeywordTagsForHighlight(rawKeywords);
  if (!tags.length) return null;

  const trNorm = normalizeLenientAnswer(tr);
  for (const tag of tags) {
    const tn = normalizeLenientAnswer(tag);
    if (!tn) continue;
    if (!trNorm.includes(tn)) return null;
  }

  let remain = trNorm;
  for (const ch of collectKeywordClozeLiteralChunks(exp, rawKeywords)) {
    if (isPunctuationOnlyChunk(ch)) continue;
    const n = normalizeLenientAnswer(ch);
    if (!n) continue;
    const idx = remain.indexOf(n);
    if (idx < 0) {
      /** Keywords already verified above — fill canonical line even if literals are out of order. */
      return exp;
    }
    remain = remain.slice(idx + n.length).replace(/^\s+/u, "");
  }
  return exp;
}
