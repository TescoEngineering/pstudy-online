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

export function parseGeneratedPayload(jsonText: string): RawPayload {
  const data = JSON.parse(jsonText) as unknown;
  if (!data || typeof data !== "object") throw new Error("Model returned invalid JSON root");
  const o = data as Record<string, unknown>;
  const flashcards = Array.isArray(o.flashcards) ? o.flashcards : [];
  const multipleChoice = Array.isArray(o.multipleChoice) ? o.multipleChoice : [];
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
      const opts = [w1, w2, w3, w4].filter(Boolean);
      if (opts.length < 3) continue;
      out.push({
        description,
        explanation,
        multiplechoice1: w1,
        multiplechoice2: w2,
        multiplechoice3: w3,
        multiplechoice4: w4,
        picture_url: "",
        instruction: "",
      });
    }
  }

  return out;
}

export function buildSystemPrompt(): string {
  return `You are an expert teacher assistant for PSTUDY, a flashcard and quiz app.
You ONLY output valid JSON matching the user's schema. No markdown fences, no commentary.
Use clear, factual wording grounded in the source document. If the document is thin, still produce useful items without inventing unrelated topics.
Keywords (flashcards): 1–4 short important phrases from the answer side, separated by semicolons; each phrase at least 2 characters; no duplicates.`;
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
Each object: "description" (multiple-choice question stem), "explanation" (the single correct answer text),
"wrong1","wrong2","wrong3","wrong4" (four plausible incorrect options, all different from each other and from the correct answer).
Set "flashcards": [].`;
  } else {
    spec = `Produce exactly one JSON object with two keys:
- "flashcards": array of ${fc} objects as above (description, explanation, keywords with semicolons).
- "multipleChoice": array of ${mc} objects as above (description, explanation, wrong1..wrong4).`;
  }

  return `SOURCE DOCUMENT:\n---\n${doc}\n---\n\n${spec}`;
}
