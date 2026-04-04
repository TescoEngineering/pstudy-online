/**
 * Build prompts and parse model output for “document → deck items”.
 * Content is sent to the configured LLM (OpenAI-compatible API); do not use for highly sensitive data
 * unless your org policy allows it.
 */

import type { PStudyItem } from "@/types/pstudy";

export const MAX_DOCUMENT_CHARS = 28_000;

export type GenerateOutputMode = "flashcards" | "multiple_choice" | "both";

export type GenerateRequestBody = {
  documentText: string;
  outputMode: GenerateOutputMode;
  /** Target count when outputMode is flashcards or both (flashcard slice). Default 12. */
  flashcardCount?: number;
  /** Target count when outputMode is multiple_choice or both. Default 10. */
  multipleChoiceCount?: number;
  /** Optional deck title; server falls back from document snippet. */
  deckTitle?: string;
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
  outputMode: GenerateOutputMode
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
      const wrong = [w1, w2, w3, w4].filter(Boolean);
      if (wrong.length < 3) continue;
      const padded =
        wrong.length === 3 ? [...wrong, "None of the above"] : wrong.slice(0, 4);
      const [m1, m2, m3, m4] = [
        padded[0] ?? "",
        padded[1] ?? "",
        padded[2] ?? "",
        padded[3] ?? "",
      ];
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

/** Rules the model must follow for professional-quality multiple choice. */
export function mcDistractorQualityBlock(): string {
  return `MULTIPLE-CHOICE DISTRACTOR QUALITY (critical):
- Every wrong option must belong to the SAME topic and domain as the question and the source document (e.g. if the text is GMP, sterile manufacture, validation, microbiology, etc., ALL four wrong answers must plausibly relate to that domain).
- FORBIDDEN: joke answers, random unrelated professions, or obviously silly distractors (e.g. "accounting", "marketing", "sales", "tourism") when the topic is technical, regulatory, or scientific unless those words literally appear in the document as relevant.
- Each distractor should look like something a thoughtful reader might consider: common misconceptions, overly narrow or overly broad versions of the truth, reversed cause/effect, a requirement that sounds similar but is wrong under the standard in the text, or a confusable term from the same field.
- NUANCE / DISCRIMINATION (aim high): Prefer wrong answers that are wrong for a *subtle* reason someone could miss on a careful exam—not only "vaguely related" but *almost right*. Draw distractors from the same passage: adjacent requirements, the opposite scope (facility vs product vs personnel), a procedure that belongs to another step, a role or document name that sounds right but is wrong for this question, or a standard/requirement stated elsewhere in the text that does not answer this stem.
- Mix difficulty across the four wrong options: include at least two "hard" distractors (a prepared student must recall a specific detail from the document to rule them out) and avoid more than one that is easy to eliminate without rereading the relevant idea.
- Match tone and length: wrong options should be similar in style and rough length to the correct answer (not one-word jokes vs long formal correct answer).
- All five texts (one correct + four wrong) must be mutually distinct; wrong options must not paraphrase the correct answer.
BAD EXAMPLE (do not do this): Question about sterile product personnel → wrong answers about accounting, sales, marketing.
GOOD PATTERN: Wrong answers still about training, qualifications, gowning, supervision, or regulatory expectations—but incorrect per the document, ideally confusable with a nearby true statement that is not the answer to this question.`;
}

export function buildSystemPrompt(): string {
  return `You are an expert teacher and assessment author for PSTUDY, a flashcard and quiz app.
Reply with a single JSON object only. First character must be "{" and last "}". No markdown, no code fences, no explanation before or after the JSON.
Ground every item in the source document. Prefer precise, exam-style wording. Do not dumb down.

${mcDistractorQualityBlock()}

Flashcards: "description" = concise prompt or term; "explanation" = clear, complete answer. Keywords: 1–4 important phrases from the answer (semicolon-separated), each at least 2 characters, no duplicates.`;
}

export function buildUserPrompt(
  doc: string,
  outputMode: GenerateOutputMode,
  flashcardCount: number,
  mcCount: number
): string {
  const fc = Math.max(4, Math.min(40, flashcardCount));
  const mc = Math.max(4, Math.min(40, mcCount));

  let spec = "";
  if (outputMode === "flashcards") {
    spec = `Produce exactly one JSON object with key "flashcards": an array of ${fc} objects.
Each object: "description" (short question or term for the card front), "explanation" (answer / back), "keywords" (optional string, phrases separated by semicolons).
Set "multipleChoice": [].`;
  } else if (outputMode === "multiple_choice") {
    spec = `Produce exactly one JSON object with key "multipleChoice": an array of ${mc} objects.
Each object: "description" (clear question stem), "explanation" (the one correct answer, justified by the document),
"wrong1","wrong2","wrong3","wrong4" — four INCORRECT options that obey MULTIPLE-CHOICE DISTRACTOR QUALITY above (same domain, exam-level nuance: mostly subtle/near-miss wrong answers grounded in the same document, not off-topic joke distractors).
Set "flashcards": [].`;
  } else {
    spec = `Produce exactly one JSON object with two keys:
- "flashcards": array of ${fc} objects (description, explanation, keywords with semicolons) — precise and grounded in the document.
- "multipleChoice": array of ${mc} objects; for each MC item obey MULTIPLE-CHOICE DISTRACTOR QUALITY in the system instructions (domain-aligned, nuanced wrong answers—prefer subtle near-misses from the text, not trivial distractors).`;
  }

  return `SOURCE DOCUMENT:\n---\n${doc}\n---\n\n${spec}`;
}
