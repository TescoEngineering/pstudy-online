/**
 * Build prompts and parse model output for “document → deck items”.
 * Content is sent to the configured LLM (OpenAI-compatible API); do not use for highly sensitive data
 * unless your org policy allows it.
 */

import type { PStudyItem } from "@/types/pstudy";

/** Server-side cap for AI deck generation; keeps one request bounded (cost/latency). ~40k chars ≈ well under typical model context limits. */
export const MAX_DOCUMENT_CHARS = 40_000;

export type GenerateOutputMode = "flashcards" | "multiple_choice" | "both";

/** Language for AI-generated card text. "auto" follows the source document. */
export const DECK_GENERATION_LANGUAGE_CODES = [
  "auto",
  "en",
  "de",
  "es",
  "fr",
  "it",
  "nl",
] as const;
export type DeckGenerationLanguage = (typeof DECK_GENERATION_LANGUAGE_CODES)[number];

export function normalizeDeckGenerationLanguage(raw: unknown): DeckGenerationLanguage {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "" || s === "auto") return "auto";
  return (DECK_GENERATION_LANGUAGE_CODES as readonly string[]).includes(s)
    ? (s as DeckGenerationLanguage)
    : "auto";
}

/** English directive appended to the system prompt so JSON field values use the right language. */
export function deckGenerationLanguageDirective(lang: DeckGenerationLanguage): string {
  if (lang === "auto") {
    return `OUTPUT LANGUAGE (critical): Every user-visible string ("description", "explanation", every wrong option, "keywords") MUST be in the SAME language as the SOURCE DOCUMENT—not a translation into another language. If the source is English, write ONLY English (do not output Spanish, French, etc.). If the source is Spanish, write only Spanish. If the source is mixed, use the language of the passage each item comes from. JSON keys stay English.`;
  }
  const name: Record<Exclude<DeckGenerationLanguage, "auto">, string> = {
    en: "English",
    de: "German",
    es: "Spanish",
    fr: "French",
    it: "Italian",
    nl: "Dutch",
  };
  const label = name[lang];
  return `OUTPUT LANGUAGE: Write every "description", "explanation", each multiple-choice wrong option (wrong1, wrong2, …), and "keywords" in ${label} (language code ${lang}). Keep established technical terms from the source when usual in that field, but full sentences must be natural ${label}. JSON keys remain in English.`;
}

/** Incorrect alternatives besides the correct answer; total choices = this + 1. */
export type McWrongOptionCount = 3 | 4;

export function clampMcWrongOptionCount(n: unknown): McWrongOptionCount {
  let x = 4;
  if (typeof n === "number" && Number.isFinite(n)) x = Math.floor(n);
  else if (typeof n === "string" && n.trim() !== "") {
    const p = parseInt(n, 10);
    if (Number.isFinite(p)) x = p;
  }
  return x === 3 ? 3 : 4;
}

export type GenerateRequestBody = {
  documentText: string;
  outputMode: GenerateOutputMode;
  /** Target count when outputMode is flashcards or both (flashcard slice). Default 12. */
  flashcardCount?: number;
  /** Target count when outputMode is multiple_choice or both. Default 10. */
  multipleChoiceCount?: number;
  /** Wrong answers per MC item: 3 → four choices total; 4 → five (default). */
  mcWrongOptionCount?: McWrongOptionCount;
  /** Optional deck title; server falls back from document snippet. */
  deckTitle?: string;
  /** Card text language: auto | en | de | es | fr | it | nl */
  deckLanguage?: DeckGenerationLanguage;
};

export function truncateDocument(text: string): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= MAX_DOCUMENT_CHARS) return { text: t, truncated: false };
  return {
    text: `${t.slice(0, MAX_DOCUMENT_CHARS)}\n\n[…truncated for length; increase density or split the document.]`,
    truncated: true,
  };
}

type RawFlashcard = {
  description?: string;
  explanation?: string;
  keywords?: string;
};

type RawMc = {
  description?: string;
  explanation?: string;
  wrong1?: string;
  wrong2?: string;
  wrong3?: string;
  wrong4?: string;
};

type RawPayload = {
  flashcards?: RawFlashcard[];
  multipleChoice?: RawMc[];
};

function cleanStr(s: unknown): string {
  if (s == null) return "";
  return String(s).trim();
}

/** Strip ```json fences and outer noise some models still emit. */
export function sanitizeModelJsonText(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```\s*$/im.exec(s);
  if (fence) s = fence[1].trim();
  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) s = s.slice(objStart, objEnd + 1);
  return s.trim();
}

function firstArray(
  o: Record<string, unknown>,
  keys: string[]
): Record<string, unknown>[] {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [];
}

function strOpt(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

function normalizeFlashRow(row: Record<string, unknown>): RawFlashcard {
  return {
    description: strOpt(row.description),
    explanation: strOpt(row.explanation),
    keywords: strOpt(row.keywords ?? row.keyword_hints),
  };
}

function normalizeMcRow(row: Record<string, unknown>): RawMc {
  return {
    description: strOpt(row.description ?? row.question ?? row.stem),
    explanation: strOpt(row.explanation ?? row.correct ?? row.answer),
    wrong1: strOpt(row.wrong1 ?? row.wrong_1 ?? row.distractor1),
    wrong2: strOpt(row.wrong2 ?? row.wrong_2 ?? row.distractor2),
    wrong3: strOpt(row.wrong3 ?? row.wrong_3 ?? row.distractor3),
    wrong4: strOpt(row.wrong4 ?? row.wrong_4 ?? row.distractor4),
  };
}

export function parseGeneratedPayload(jsonText: string): RawPayload {
  const sanitized = sanitizeModelJsonText(jsonText);
  let data: unknown;
  try {
    data = JSON.parse(sanitized);
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  if (!data || typeof data !== "object") throw new Error("Model returned invalid JSON root");
  const o = data as Record<string, unknown>;
  const fcRows = firstArray(o, ["flashcards", "flash_cards", "flashCards", "cards"]);
  const mcRows = firstArray(o, ["multipleChoice", "multiple_choice", "multipleChoiceQuestions", "mc"]);
  const flashcards = fcRows.map((r) => normalizeFlashRow(r ?? {}));
  const multipleChoice = mcRows.map((r) => normalizeMcRow(r ?? {}));
  return { flashcards: flashcards as RawFlashcard[], multipleChoice: multipleChoice as RawMc[] };
}

/** PSTUDY MC practice: with “Ask for = Explanation”, correct is `explanation`, options pool is explanation + mc1–4. */
export function rawToStudyItems(
  raw: RawPayload,
  outputMode: GenerateOutputMode,
  mcWrongOptionCount: McWrongOptionCount = 4
): Omit<PStudyItem, "id">[] {
  const out: Omit<PStudyItem, "id">[] = [];

  const emptyMc = {
    multiplechoice1: "",
    multiplechoice2: "",
    multiplechoice3: "",
    multiplechoice4: "",
  };

  if (outputMode === "flashcards" || outputMode === "both") {
    for (const row of raw.flashcards ?? []) {
      const description = cleanStr(row.description);
      const explanation = cleanStr(row.explanation);
      if (!description || !explanation) continue;
      const keywords = cleanStr(row.keywords);
      out.push({
        description,
        explanation,
        ...emptyMc,
        picture_url: "",
        instruction: "",
        ...(keywords ? { keywords } : {}),
      });
    }
  }

  if (outputMode === "multiple_choice" || outputMode === "both") {
    for (const row of raw.multipleChoice ?? []) {
      const description = cleanStr(row.description);
      const explanation = cleanStr(row.explanation);
      const w1 = cleanStr(row.wrong1);
      const w2 = cleanStr(row.wrong2);
      const w3 = cleanStr(row.wrong3);
      const w4 = cleanStr(row.wrong4);
      if (!description || !explanation) continue;

      let m1 = "";
      let m2 = "";
      let m3 = "";
      let m4 = "";

      if (mcWrongOptionCount === 3) {
        if (!w1 || !w2 || !w3) continue;
        m1 = w1;
        m2 = w2;
        m3 = w3;
        m4 = "";
      } else {
        const wrong = [w1, w2, w3, w4].filter(Boolean);
        if (wrong.length < 3) continue;
        const padded =
          wrong.length === 3 ? [...wrong, "None of the above"] : wrong.slice(0, 4);
        m1 = padded[0] ?? "";
        m2 = padded[1] ?? "";
        m3 = padded[2] ?? "";
        m4 = padded[3] ?? "";
      }

      out.push({
        description,
        explanation,
        multiplechoice1: m1,
        multiplechoice2: m2,
        multiplechoice3: m3,
        multiplechoice4: m4,
        picture_url: "",
        instruction: "",
      });
    }
  }

  return out;
}

/** PSTUDY practice treats items with any `multiplechoice*` text as multiple-choice; plain flashcards leave those empty. */
export function itemLooksLikeMultipleChoice(
  item: Pick<
    PStudyItem,
    "multiplechoice1" | "multiplechoice2" | "multiplechoice3" | "multiplechoice4"
  >
): boolean {
  return [item.multiplechoice1, item.multiplechoice2, item.multiplechoice3, item.multiplechoice4].some(
    (s) => String(s ?? "").trim().length > 0
  );
}

/** Split a combined AI payload into flashcard-only vs MC-only slices (for two decks when `outputMode` is "both"). */
export function splitGeneratedItemsByPracticeKind<T extends Omit<PStudyItem, "id">>(
  items: T[]
): { flashcardItems: T[]; multipleChoiceItems: T[] } {
  const flashcardItems: T[] = [];
  const multipleChoiceItems: T[] = [];
  for (const it of items) {
    if (itemLooksLikeMultipleChoice(it)) multipleChoiceItems.push(it);
    else flashcardItems.push(it);
  }
  return { flashcardItems, multipleChoiceItems };
}

/** Same 4–40 bounds as in buildUserPrompt item targets. */
export function clampDeckItemTargetCount(n: number, fallback: number): number {
  const x = Number.isFinite(n) ? Math.floor(n) : fallback;
  return Math.max(4, Math.min(40, x));
}

/**
 * When the model returns more rows than requested, keep items **spread across** the full list
 * (model order often follows the document). Avoids keeping only the first chunk and discarding
 * everything from later sections — still a heuristic, not a quality score.
 */
export function downsampleAiItems<T>(items: T[], keep: number): T[] {
  const n = items.length;
  if (keep <= 0) return [];
  if (n <= keep) return items.slice();
  const chosen = new Set<number>();
  for (let j = 0; j < keep; j++) {
    chosen.add(Math.min(n - 1, Math.floor(((j + 0.5) * n) / keep)));
  }
  let p = 0;
  while (chosen.size < keep && p < n) {
    if (!chosen.has(p)) chosen.add(p);
    p++;
  }
  return [...chosen]
    .sort((a, b) => a - b)
    .slice(0, keep)
    .map((i) => items[i]!);
}

/**
 * Model JSON sometimes contains extra items; PSTUDY only keeps up to the requested counts
 * (flashcard slice, MC slice, or both — FC first, then MC, matching rawToStudyItems order).
 * Excess rows are **downsampled evenly** across the model’s ordering, not “first N only”.
 */
export function capAiGeneratedItems(
  items: Omit<PStudyItem, "id">[],
  outputMode: GenerateOutputMode,
  flashcardTarget: number,
  mcTarget: number
): Omit<PStudyItem, "id">[] {
  const fc = clampDeckItemTargetCount(flashcardTarget, 12);
  const mc = clampDeckItemTargetCount(mcTarget, 10);
  if (outputMode === "flashcards") {
    return downsampleAiItems(items, fc);
  }
  if (outputMode === "multiple_choice") {
    return downsampleAiItems(items, mc);
  }
  const { flashcardItems, multipleChoiceItems } = splitGeneratedItemsByPracticeKind(items);
  return [...downsampleAiItems(flashcardItems, fc), ...downsampleAiItems(multipleChoiceItems, mc)];
}

function requestedAiItemBudget(
  outputMode: GenerateOutputMode,
  flashcardTarget: number,
  mcTarget: number
): number {
  const fc = clampDeckItemTargetCount(flashcardTarget, 12);
  const mc = clampDeckItemTargetCount(mcTarget, 10);
  if (outputMode === "flashcards") return fc;
  if (outputMode === "multiple_choice") return mc;
  return fc + mc;
}

/**
 * If the model returns **at most 20% more** rows than the configured target total, keep every row.
 * Otherwise apply {@link capAiGeneratedItems} (even downsample) so large overruns still fit app limits;
 * the API can then attach `itemsFull` + capped `items` for export.
 *
 * “More than 20%” uses integer math: cap when `items.length * 5 > requested * 6` (strictly above 120% of target).
 */
export function maybeCapAiGeneratedItems(
  items: Omit<PStudyItem, "id">[],
  outputMode: GenerateOutputMode,
  flashcardTarget: number,
  mcTarget: number
): Omit<PStudyItem, "id">[] {
  const requested = requestedAiItemBudget(outputMode, flashcardTarget, mcTarget);
  if (items.length * 5 <= requested * 6) {
    return items.slice();
  }
  return capAiGeneratedItems(items, outputMode, flashcardTarget, mcTarget);
}

/** Rules the model must follow for professional-quality multiple choice. */
export function mcDistractorQualityBlock(): string {
  return `MULTIPLE-CHOICE DISTRACTOR QUALITY (critical):
- Every wrong option must belong to the SAME topic and domain as the question and the source document (e.g. if the text is GMP, sterile manufacture, validation, microbiology, etc., ALL four wrong answers must plausibly relate to that domain).
- FORBIDDEN: joke answers, random unrelated professions, or obviously silly distractors (e.g. "accounting", "marketing", "sales", "tourism") when the topic is technical, regulatory, or scientific unless those words literally appear in the document as relevant.
- Each distractor should look like something a thoughtful reader might consider: common misconceptions, overly narrow or overly broad versions of the truth, reversed cause/effect, a requirement that sounds similar but is wrong under the standard in the text, or a confusable term from the same field.
- NUANCE / DISCRIMINATION (aim high): Prefer wrong answers that are wrong for a *subtle* reason someone could miss on a careful exam—not only "vaguely related" but *almost right*. Draw distractors from the same passage: adjacent requirements, the opposite scope (facility vs product vs personnel), a procedure that belongs to another step, a role or document name that sounds right but is wrong for this question, or a standard/requirement stated elsewhere in the text that does not answer this stem.
- Mix difficulty across the four wrong options: include at least two "hard" distractors (a prepared student must recall a specific detail from the document to rule them out) and avoid more than one that is easy to eliminate without rereading the relevant idea.
- Match tone and length: wrong options should be similar in style and rough length to the correct answer (not one-word jokes vs long formal correct answer).
- LENGTH PARITY (critical — prevents "pick the longest" guessing): The correct "explanation" must NOT be the only long or detailed line. Every wrong option must be a **full phrase or sentence** in the **same ballpark for length** as "explanation" (aim within roughly ±35% of its character count unless the correct line is very short). Use parallel grammar: if the correct answer starts with "They must…", "Personnel should…", "The procedure requires…", etc., write wrong answers in the **same pattern** with similar clause count—not stubs like "Training" or "Yes, annually" while the correct answer is two lines.
- Do not make the correct option uniquely elaborate (lists, semicolons, parentheticals, definitions) unless **every** option uses a similar level of detail. If the document phrase for the truth is short, expand **all** options to concise parallel full sentences of matched length; do not only expand the correct one.
- All options (correct "explanation" plus every wrong field you output) must be mutually distinct; wrong options must not paraphrase the correct answer.
BAD EXAMPLE (do not do this): Question about sterile product personnel → wrong answers about accounting, sales, marketing.
GOOD PATTERN: Wrong answers still about training, qualifications, gowning, supervision, or regulatory expectations—but incorrect per the document, ideally confusable with a nearby true statement that is not the answer to this question. Before you output each MC object, quickly check: if one line is much longer than the others, rewrite so they are even.`;
}

export function buildSystemPrompt(deckLanguage: DeckGenerationLanguage = "auto"): string {
  return `You are an expert teacher and assessment author for PSTUDY, a flashcard and quiz app.
Reply with a single JSON object only. First character must be "{" and last "}". No markdown, no code fences, no explanation before or after the JSON.
Ground every item in the source document. Prefer precise, exam-style wording. Do not dumb down.

${mcDistractorQualityBlock()}

Flashcards: "description" = concise prompt or term; "explanation" = clear, complete answer. Keywords: 1–4 important phrases from the answer (semicolon-separated), each at least 2 characters, no duplicates.

${deckGenerationLanguageDirective(deckLanguage)}`;
}

export function buildUserPrompt(
  doc: string,
  outputMode: GenerateOutputMode,
  flashcardCount: number,
  mcCount: number,
  mcWrongOptionCount: McWrongOptionCount = 4
): string {
  const fc = Math.max(4, Math.min(40, flashcardCount));
  const mc = Math.max(4, Math.min(40, mcCount));

  const mcWrongSpec =
    mcWrongOptionCount === 3
      ? `"wrong1","wrong2","wrong3" only — exactly THREE incorrect options (omit wrong4 or use ""). PSTUDY shows 4 choices total including "explanation" as the correct answer. All four choices must obey LENGTH PARITY in the system instructions (no single standout longest answer).`
      : `"wrong1","wrong2","wrong3","wrong4" — four INCORRECT options that obey MULTIPLE-CHOICE DISTRACTOR QUALITY above (same domain, exam-level nuance, parallel length and grammar to "explanation"). Five choices total including "explanation".`;

  let spec = "";
  if (outputMode === "flashcards") {
    spec = `Produce exactly one JSON object with key "flashcards": an array of exactly ${fc} objects and no more.
Each object: "description" (short question or term for the card front), "explanation" (answer / back), "keywords" (optional string, phrases separated by semicolons).
Set "multipleChoice": [].`;
  } else if (outputMode === "multiple_choice") {
    spec = `Produce exactly one JSON object with key "multipleChoice": an array of exactly ${mc} objects and no more.
Each object: "description" (clear question stem), "explanation" (the one correct answer, justified by the document),
${mcWrongSpec}
Set "flashcards": [].`;
  } else {
    spec = `Produce exactly one JSON object with two keys:
- "flashcards": array of exactly ${fc} objects (description, explanation, keywords with semicolons) — precise and grounded in the document; no extra flashcards.
- "multipleChoice": array of exactly ${mc} objects; each object has "description", "explanation", and ${mcWrongOptionCount === 3 ? "exactly three distractors wrong1–wrong3 (MULTIPLE-CHOICE DISTRACTOR QUALITY)" : "four distractors wrong1–wrong4 (MULTIPLE-CHOICE DISTRACTOR QUALITY)"}; no extra MC rows.`;
  }

  return `SOURCE DOCUMENT:\n---\n${doc}\n---\n\n${spec}\n\nFollow the SOURCE DOCUMENT language for all visible text (see OUTPUT LANGUAGE in system). Do not change language (e.g. English source → never Spanish deck). Obey exact array lengths above.`;
}
