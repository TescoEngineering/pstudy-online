import type { Deck, PStudyItem } from "@/types/pstudy";

export type ExamPromptMode = "description" | "explanation";
export type ExamType = "multiple-choice" | "straight-answer";
export type StraightGradingMode = "exact-match" | "lenient-match";

export type ExamValidationIssue = {
  itemIndex: number;
  messageKey: "emptyCorrect" | "emptyPrompt" | "notEnoughChoices" | "emptyExpectedForStraight";
};

function trim(s: string): string {
  return String(s ?? "").trim();
}

/** Build MC choices the same way as practice multiple-choice mode. */
export function buildMcChoices(item: PStudyItem, promptMode: ExamPromptMode): string[] {
  const correctAnswer =
    promptMode === "description" ? item.description : item.explanation;
  const choices = [
    correctAnswer,
    item.multiplechoice1,
    item.multiplechoice2,
    item.multiplechoice3,
    item.multiplechoice4,
  ]
    .map((s) => trim(String(s ?? "")))
    .filter((s) => s !== "")
    .filter((v, i, a) => a.indexOf(v) === i);
  return choices;
}

/** Prompt text shown above choices (matches practice page). */
export function examPromptText(item: PStudyItem, promptMode: ExamPromptMode): string {
  return trim(promptMode === "description" ? item.explanation : item.description);
}

export function expectedAnswerText(item: PStudyItem, promptMode: ExamPromptMode): string {
  return trim(promptMode === "description" ? item.description : item.explanation);
}

/**
 * Returns issues for items that cannot be used in a scored multiple-choice exam.
 * Rules: ≥2 items in deck; each item needs non-empty correct + prompt side and ≥2 distinct choices.
 */
export function validateDeckForMcExam(
  deck: Deck,
  promptMode: ExamPromptMode
): ExamValidationIssue[] {
  const issues: ExamValidationIssue[] = [];
  if (deck.items.length < 2) {
    return issues;
  }
  deck.items.forEach((item, itemIndex) => {
    const correct =
      promptMode === "description" ? trim(item.description) : trim(item.explanation);
    if (!correct) {
      issues.push({ itemIndex, messageKey: "emptyCorrect" });
      return;
    }
    const prompt = examPromptText(item, promptMode);
    if (!prompt && !trim(item.instruction)) {
      issues.push({ itemIndex, messageKey: "emptyPrompt" });
      return;
    }
    const choices = buildMcChoices(item, promptMode);
    if (choices.length < 2) {
      issues.push({ itemIndex, messageKey: "notEnoughChoices" });
    }
  });
  return issues;
}

export function isDeckValidForMcExam(deck: Deck, promptMode: ExamPromptMode): boolean {
  if (deck.items.length < 2) return false;
  return validateDeckForMcExam(deck, promptMode).length === 0;
}

export function validateDeckForStraightExam(
  deck: Deck,
  promptMode: ExamPromptMode
): ExamValidationIssue[] {
  const issues: ExamValidationIssue[] = [];
  if (deck.items.length < 2) return issues;

  deck.items.forEach((item, itemIndex) => {
    const expected = expectedAnswerText(item, promptMode);
    if (!expected) {
      issues.push({ itemIndex, messageKey: "emptyExpectedForStraight" });
      return;
    }
    const prompt = examPromptText(item, promptMode);
    if (!prompt && !trim(item.instruction)) {
      issues.push({ itemIndex, messageKey: "emptyPrompt" });
    }
  });

  return issues;
}

export function normalizeLenientAnswer(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "");
}
