import { describe, expect, it } from "vitest";
import { parseGeneratedPayload, rawToStudyItems, truncateDocument } from "./ai-deck-generate";

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
});
