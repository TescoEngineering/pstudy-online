import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  capAiGeneratedItems,
  downsampleAiItems,
  maybeCapAiGeneratedItems,
  normalizeDeckGenerationLanguage,
  parseGeneratedPayload,
  rawToStudyItems,
  sanitizeModelJsonText,
  splitGeneratedItemsByPracticeKind,
  truncateDocument,
} from "./ai-deck-generate";
import type { PStudyItem } from "@/types/pstudy";

describe("truncateDocument", () => {
  it("does not truncate short text", () => {
    const { text, truncated } = truncateDocument("hello");
    expect(text).toBe("hello");
    expect(truncated).toBe(false);
  });
});

describe("parseGeneratedPayload + rawToStudyItems", () => {
  it("maps flashcards and MC", () => {
    const json = JSON.stringify({
      flashcards: [
        { description: "Q1", explanation: "A1", keywords: "foo; bar" },
      ],
      multipleChoice: [
        {
          description: "MQ?",
          explanation: "Right",
          wrong1: "W1",
          wrong2: "W2",
          wrong3: "W3",
          wrong4: "W4",
        },
      ],
    });
    const raw = parseGeneratedPayload(json);
    const items = rawToStudyItems(raw, "both");
    expect(items.length).toBe(2);
    expect(items[0]?.description).toBe("Q1");
    expect(items[0]?.keywords).toBe("foo; bar");
    expect(items[1]?.explanation).toBe("Right");
    expect(items[1]?.multiplechoice1).toBe("W1");
    expect(items[1]?.multiplechoice4).toBe("W4");
  });

  it("MC with three wrong options leaves fourth slot empty", () => {
    const json = JSON.stringify({
      flashcards: [],
      multipleChoice: [
        {
          description: "Q?",
          explanation: "Correct",
          wrong1: "a",
          wrong2: "b",
          wrong3: "c",
          wrong4: "should be ignored",
        },
      ],
    });
    const raw = parseGeneratedPayload(json);
    const items = rawToStudyItems(raw, "multiple_choice", 3);
    expect(items).toHaveLength(1);
    expect(items[0]?.multiplechoice3).toBe("c");
    expect(items[0]?.multiplechoice4).toBe("");
  });

  it("strips markdown fences and accepts multiple_choice alias", () => {
    const inner = JSON.stringify({
      flashcards: [],
      multiple_choice: [
        {
          description: "Q?",
          explanation: "Yes",
          wrong1: "a",
          wrong2: "b",
          wrong3: "c",
          wrong4: "d",
        },
      ],
    });
    const raw = parseGeneratedPayload(`Here you go:\n\`\`\`json\n${inner}\n\`\`\``);
    const items = rawToStudyItems(raw, "multiple_choice");
    expect(items.length).toBe(1);
    expect(items[0]?.explanation).toBe("Yes");
  });
});

describe("splitGeneratedItemsByPracticeKind", () => {
  it("splits flashcards (empty MC slots) from MC items", () => {
    const json = JSON.stringify({
      flashcards: [{ description: "F", explanation: "A" }],
      multipleChoice: [
        {
          description: "M?",
          explanation: "OK",
          wrong1: "w1",
          wrong2: "w2",
          wrong3: "w3",
          wrong4: "w4",
        },
      ],
    });
    const raw = parseGeneratedPayload(json);
    const items = rawToStudyItems(raw, "both");
    const { flashcardItems, multipleChoiceItems } = splitGeneratedItemsByPracticeKind(items);
    expect(flashcardItems).toHaveLength(1);
    expect(flashcardItems[0]?.description).toBe("F");
    expect(multipleChoiceItems).toHaveLength(1);
    expect(multipleChoiceItems[0]?.multiplechoice1).toBe("w1");
  });
});

describe("normalizeDeckGenerationLanguage + buildSystemPrompt", () => {
  it("normalizes deck language codes", () => {
    expect(normalizeDeckGenerationLanguage(undefined)).toBe("auto");
    expect(normalizeDeckGenerationLanguage("NL")).toBe("nl");
    expect(normalizeDeckGenerationLanguage("xx")).toBe("auto");
  });

  it("includes language directive in system prompt", () => {
    const auto = buildSystemPrompt("auto");
    const nl = buildSystemPrompt("nl");
    expect(auto).toMatch(/OUTPUT LANGUAGE/i);
    expect(auto).toMatch(/SOURCE DOCUMENT/i);
    expect(nl).toContain("Dutch");
    expect(nl).toContain("nl");
  });
});

describe("capAiGeneratedItems", () => {
  const fc = (n: number): Omit<PStudyItem, "id"> => ({
    description: `F${n}`,
    explanation: `A${n}`,
    multiplechoice1: "",
    multiplechoice2: "",
    multiplechoice3: "",
    multiplechoice4: "",
    picture_url: "",
    instruction: "",
  });
  const mc = (n: number): Omit<PStudyItem, "id"> => ({
    description: `Q${n}`,
    explanation: `OK${n}`,
    multiplechoice1: "w1",
    multiplechoice2: "w2",
    multiplechoice3: "w3",
    multiplechoice4: "w4",
    picture_url: "",
    instruction: "",
  });

  it("limits multiple_choice items to target (even spread, not only first chunk)", () => {
    const many = Array.from({ length: 70 }, (_, i) => mc(i));
    const capped = capAiGeneratedItems(many, "multiple_choice", 12, 40);
    expect(capped).toHaveLength(40);
    expect(capped[capped.length - 1]?.description).toBe("Q69");
    expect(capped[0]?.description).toBe("Q0");
  });

  it("downsampleAiItems keeps spread across the list", () => {
    const arr = Array.from({ length: 10 }, (_, i) => i);
    const out = downsampleAiItems(arr, 5);
    expect(out).toEqual([1, 3, 5, 7, 9]);
  });

  it("limits each kind when both", () => {
    const items = [...Array.from({ length: 20 }, (_, i) => fc(i)), ...Array.from({ length: 70 }, (_, i) => mc(i))];
    const capped = capAiGeneratedItems(items, "both", 12, 40);
    expect(capped.filter((x) => !x.multiplechoice1)).toHaveLength(12);
    expect(capped.filter((x) => x.multiplechoice1)).toHaveLength(40);
    expect(capped).toHaveLength(52);
  });
});

describe("maybeCapAiGeneratedItems", () => {
  const fc = (n: number): Omit<PStudyItem, "id"> => ({
    description: `F${n}`,
    explanation: `A${n}`,
    multiplechoice1: "",
    multiplechoice2: "",
    multiplechoice3: "",
    multiplechoice4: "",
    picture_url: "",
    instruction: "",
  });
  const mc = (n: number): Omit<PStudyItem, "id"> => ({
    description: `Q${n}`,
    explanation: `OK${n}`,
    multiplechoice1: "w1",
    multiplechoice2: "w2",
    multiplechoice3: "w3",
    multiplechoice4: "w4",
    picture_url: "",
    instruction: "",
  });

  it("keeps every row when at most 20% over target (MC)", () => {
    const rows = Array.from({ length: 48 }, (_, i) => mc(i));
    const out = maybeCapAiGeneratedItems(rows, "multiple_choice", 12, 40);
    expect(out).toHaveLength(48);
  });

  it("caps when strictly above 20% over target (MC)", () => {
    const rows = Array.from({ length: 49 }, (_, i) => mc(i));
    const out = maybeCapAiGeneratedItems(rows, "multiple_choice", 12, 40);
    expect(out).toHaveLength(40);
  });

  it("keeps every row when at most 20% over (flashcards)", () => {
    const rows = Array.from({ length: 14 }, (_, i) => fc(i));
    const out = maybeCapAiGeneratedItems(rows, "flashcards", 12, 10);
    expect(out).toHaveLength(14);
  });

  it("caps flashcards when above 120% of target", () => {
    const rows = Array.from({ length: 15 }, (_, i) => fc(i));
    const out = maybeCapAiGeneratedItems(rows, "flashcards", 12, 10);
    expect(out).toHaveLength(12);
  });

  it("keeps combined both-mode list when within 120% of fc+mc target", () => {
    const rows = [...Array.from({ length: 20 }, (_, i) => fc(i)), ...Array.from({ length: 6 }, (_, i) => mc(i))];
    const out = maybeCapAiGeneratedItems(rows, "both", 12, 10);
    expect(out).toHaveLength(26);
  });

  it("caps both-mode when combined count exceeds 120% of fc+mc", () => {
    const rows = [...Array.from({ length: 20 }, (_, i) => fc(i)), ...Array.from({ length: 70 }, (_, i) => mc(i))];
    const out = maybeCapAiGeneratedItems(rows, "both", 12, 40);
    expect(out).toHaveLength(52);
    expect(out.filter((x) => !x.multiplechoice1)).toHaveLength(12);
    expect(out.filter((x) => x.multiplechoice1)).toHaveLength(40);
  });
});

describe("sanitizeModelJsonText", () => {
  it("extracts object from fenced block", () => {
    const s = sanitizeModelJsonText('```json\n{"a":1}\n```');
    expect(s).toBe('{"a":1}');
  });
});
