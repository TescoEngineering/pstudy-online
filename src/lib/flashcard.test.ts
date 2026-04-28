import { describe, expect, it } from "vitest";
import {
  buildFlashcardDisplayMultiline,
  getFlashcardLineMeta,
  keywordTagsEligibleForHighlight,
  parseFlashcardRevealSegments,
  splitKeywordTags,
  splitKeywordTagsForHighlight,
  splitLineForKeywordCloze,
  buildKeywordClozeScaffoldAnswerText,
  transcriptCompletesKeywordCloze,
  appendSpeechTranscriptChunk,
  buildProgressiveKeywordClozeAnswerFromSpeech,
  KEYWORD_CLOZE_GAP_MARKER,
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

describe("splitLineForKeywordCloze", () => {
  it("masks keywords and keeps surrounding text", () => {
    expect(splitLineForKeywordCloze("The capital is Paris.", ["Paris"])).toEqual([
      { type: "text", value: "The capital is " },
      { type: "gap", keyword: "Paris" },
      { type: "text", value: "." },
    ]);
  });

  it("is case-insensitive for tags", () => {
    expect(splitLineForKeywordCloze("talk ABOUT it", ["about"])).toEqual([
      { type: "text", value: "talk " },
      { type: "gap", keyword: "about" },
      { type: "text", value: " it" },
    ]);
  });

  it("prefers longer tags first", () => {
    expect(splitLineForKeywordCloze("New York is big", ["New York", "New"])).toEqual([
      { type: "gap", keyword: "New York" },
      { type: "text", value: " is big" },
    ]);
  });
});

describe("buildKeywordClozeScaffoldAnswerText", () => {
  it("inserts gap markers for keywords", () => {
    expect(buildKeywordClozeScaffoldAnswerText("The capital is Paris.", "Paris")).toBe(
      `The capital is ${KEYWORD_CLOZE_GAP_MARKER}.`
    );
  });
});

describe("transcriptCompletesKeywordCloze", () => {
  it("accepts normalized full line match", () => {
    expect(
      transcriptCompletesKeywordCloze("The capital is Paris", "The capital is Paris.", "Paris")
    ).toBe("The capital is Paris.");
  });

  it("accepts when literals and keywords appear in order", () => {
    expect(
      transcriptCompletesKeywordCloze("the capital is Paris today", "The capital is Paris.", "Paris")
    ).toBe("The capital is Paris.");
  });

  it("rejects missing keyword", () => {
    expect(
      transcriptCompletesKeywordCloze("the capital is Lyon", "The capital is Paris.", "Paris")
    ).toBeNull();
  });

  it("accepts speech that only matches under lenient rules and returns canonical expected", () => {
    expect(
      transcriptCompletesKeywordCloze(
        "pardon MONSIEUR where is Paris",
        "Pardon, monsieur, where is Paris?",
        "Paris"
      )
    ).toBe("Pardon, monsieur, where is Paris?");
  });

  it("accepts when keywords appear in a different order and returns canonical sentence", () => {
    expect(
      transcriptCompletesKeywordCloze(
        "Paris the capital is",
        "The capital is Paris.",
        "Paris"
      )
    ).toBe("The capital is Paris.");
  });

  it("accepts when multiple keywords are spoken out of order", () => {
    expect(
      transcriptCompletesKeywordCloze(
        "Lyon et Paris je vois bien",
        "Je vois Paris et Lyon.",
        "Paris,Lyon"
      )
    ).toBe("Je vois Paris et Lyon.");
  });
});

describe("appendSpeechTranscriptChunk", () => {
  it("returns piece when prev empty", () => {
    expect(appendSpeechTranscriptChunk("", "First.")).toBe("First.");
  });

  it("appends a second sentence", () => {
    expect(appendSpeechTranscriptChunk("First.", "Second.")).toBe("First. Second.");
  });

  it("uses longer cumulative final instead of duplicating", () => {
    expect(appendSpeechTranscriptChunk("Hello.", "Hello. World.")).toBe("Hello. World.");
  });
});

describe("buildProgressiveKeywordClozeAnswerFromSpeech", () => {
  it("fills only the sentence spoken correctly with keywords; other sentence keeps gaps", () => {
    const exp = "Bonjour. Paris est magnifique.";
    const kw = "Paris";
    const spoken = "Bonjour.";
    const out = buildProgressiveKeywordClozeAnswerFromSpeech(exp, kw, spoken);
    expect(out).toContain("Bonjour.");
    expect(out).toContain(KEYWORD_CLOZE_GAP_MARKER);
    expect(out).not.toContain("Paris");
  });

  it("fills second sentence when only second is spoken; no-keyword hint stays visible", () => {
    const exp = "Bonjour. Paris est magnifique.";
    const kw = "Paris";
    const spoken = "Paris est magnifique.";
    const out = buildProgressiveKeywordClozeAnswerFromSpeech(exp, kw, spoken);
    expect(out).toContain("Paris est magnifique.");
    expect(out).toContain("Bonjour");
    expect(out).not.toContain(KEYWORD_CLOZE_GAP_MARKER);
  });

  it("returns full expected when whole answer validated", () => {
    const exp = "Bonjour. Paris est magnifique.";
    const kw = "Paris";
    const spoken = "Bonjour. Paris est magnifique.";
    expect(buildProgressiveKeywordClozeAnswerFromSpeech(exp, kw, spoken)).toBe(exp);
  });

  it("does not revert an earlier completed keyword sentence when speech only contains a later sentence", () => {
    const exp = "Je vois Paris. Tu aimes Lyon.";
    const kw = "Paris,Lyon";
    const spokenOnlySecond = "Tu aimes Lyon.";
    const currentField = `Je vois Paris. Tu aimes ${KEYWORD_CLOZE_GAP_MARKER}.`;
    const out = buildProgressiveKeywordClozeAnswerFromSpeech(exp, kw, spokenOnlySecond, currentField);
    expect(out).toContain("Je vois Paris.");
    expect(out).toContain("Tu aimes Lyon.");
    expect(out).not.toContain(KEYWORD_CLOZE_GAP_MARKER);
  });
});
