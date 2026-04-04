import { describe, expect, it } from "vitest";
import {
  parseGeneratedPayload,
  rawToStudyItems,
  sanitizeModelJsonText,
  splitGeneratedItemsByPracticeKind,
  truncateDocument,
} from "./ai-deck-generate";

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

describe("sanitizeModelJsonText", () => {
  it("extracts object from fenced block", () => {
    const s = sanitizeModelJsonText('```json\n{"a":1}\n```');
    expect(s).toBe('{"a":1}');
  });
});
