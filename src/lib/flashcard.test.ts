import { describe, expect, it } from "vitest";
import {
  buildFlashcardDisplayMultiline,
  getFlashcardLineMeta,
  keywordTagsEligibleForHighlight,
  parseFlashcardRevealSegments,
  splitKeywordTags,
  splitKeywordTagsForHighlight,
} from "./flashcard";

describe("getFlashcardLineMeta", () => {
  it("flattens a single line", () => {
    const m = getFlashcardLineMeta("hello world");
    expect(m.words).toEqual(["hello", "world"]);
    expect(m.breaksAfter).toEqual([1]);
  });

  it("uses line breaks between rows", () => {
    const m = getFlashcardLineMeta("a b\nc d");
    expect(m.words).toEqual(["a", "b", "c", "d"]);
    expect(m.breaksAfter).toEqual([1, 3]);
  });

  it("strips bullet markers for word list", () => {
    const m = getFlashcardLineMeta("- one two\n* three");
    expect(m.words).toEqual(["one", "two", "three"]);
    expect(m.breaksAfter).toEqual([1, 2]);
  });
});

describe("buildFlashcardDisplayMultiline", () => {
  it("inserts newlines at breaks", () => {
    const words = ["a", "b", "c"];
    const filled: (string | null)[] = ["a", null, null];
    const s = buildFlashcardDisplayMultiline(words, filled, [1]);
    expect(s).toBe("a _\n_");
  });
});

describe("parseFlashcardRevealSegments", () => {
  it("separates bullets and paragraphs", () => {
    const s = parseFlashcardRevealSegments("Intro line\n- first item\n- second");
    expect(s).toEqual([
      { type: "paragraph", text: "Intro line" },
      { type: "bullet", text: "first item" },
      { type: "bullet", text: "second" },
    ]);
  });

  it("treats bullet marker without space after dash as a bullet (typed answers)", () => {
    const s = parseFlashcardRevealSegments("-apple\n*banana");
    expect(s).toEqual([
      { type: "bullet", text: "apple" },
      { type: "bullet", text: "banana" },
    ]);
  });
});

describe("splitKeywordTags", () => {
  it("splits on comma and semicolon", () => {
    expect(splitKeywordTags("a, b;c")).toEqual(["a", "b", "c"]);
  });
});

describe("keywordTagsEligibleForHighlight", () => {
  it("drops single-character tags", () => {
    expect(keywordTagsEligibleForHighlight(["hello", "t", "x"])).toEqual(["hello"]);
  });
});

describe("splitKeywordTagsForHighlight", () => {
  it("splits and drops single-character tags", () => {
    expect(splitKeywordTagsForHighlight("foo; t; bar")).toEqual(["foo", "bar"]);
  });
});
