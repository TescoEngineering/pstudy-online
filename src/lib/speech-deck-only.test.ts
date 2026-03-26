import { describe, expect, it } from "vitest";
import { resolveDeckOnlyTranscript } from "./speech";

describe("resolveDeckOnlyTranscript (deck-only STT resolution)", () => {
  it("normalizes and matches exact single-word answer", () => {
    const vocab = ["Texas", "Ohio"];
    expect(resolveDeckOnlyTranscript("texas", vocab)).toBe("Texas");
  });

  it("extracts a deck phrase when the line has filler words", () => {
    const vocab = ["Texas"];
    expect(resolveDeckOnlyTranscript("uh texas", vocab)).toBe("Texas");
  });

  it("matches two-word answers from the vocabulary", () => {
    const vocab = ["North Dakota", "South Dakota"];
    expect(resolveDeckOnlyTranscript("north dakota", vocab)).toBe("North Dakota");
  });

  it("returns null when nothing in the line maps to the deck", () => {
    const vocab = ["Texas"];
    expect(resolveDeckOnlyTranscript("ice cream", vocab)).toBeNull();
  });
});
