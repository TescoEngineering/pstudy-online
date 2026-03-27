import { describe, expect, it } from "vitest";
import {
  applyUserAliasesToTranscript,
  finalizeDeckSttFromAlternatives,
  resolveDeckOnlyTranscript,
} from "./speech";

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

  it("maps solfège mishearing though -> do when do is on the deck", () => {
    const vocab = ["do", "re", "mi"];
    expect(resolveDeckOnlyTranscript("though", vocab)).toBe("do");
  });

  it("applies per-deck user aliases when provided", () => {
    const vocab = ["do", "re"];
    const aliases = { though: "do" };
    expect(resolveDeckOnlyTranscript("Though", vocab, aliases)).toBe("do");
  });

  it("does not whole-line fuzzy 'see' to 'sol' when si is on the deck (solfège wins)", () => {
    const vocab = ["si", "sol"];
    expect(resolveDeckOnlyTranscript("see", vocab)).toBe("si");
  });

  it("prefers user alias for 'see' over whole-line fuzzy to sol", () => {
    const vocab = ["si", "sol"];
    const aliases = { see: "si" };
    expect(resolveDeckOnlyTranscript("see", vocab, aliases)).toBe("si");
  });

  it("prefers user alias 'toe' -> do over token fuzzy to sol", () => {
    const vocab = ["do", "sol"];
    expect(resolveDeckOnlyTranscript("toe", vocab, { toe: "do" })).toBe("do");
  });

  it("ranks STT alternatives so a user-alias line beats an earlier sol-like hypothesis", () => {
    const body = finalizeDeckSttFromAlternatives(["so", "see"], ["si", "sol"], {
      see: "si",
    });
    expect(body.transcript).toBe("si");
  });
});

describe("applyUserAliasesToTranscript (standard STT path)", () => {
  it("maps toe -> do and does not require fuzzy (toe vs sol distance)", () => {
    const vocab = ["do", "sol"];
    expect(applyUserAliasesToTranscript("toe", vocab, { toe: "do" })).toBe("do");
  });

  it("replaces only mapped tokens and keeps the rest", () => {
    const vocab = ["do", "Texas"];
    const aliases = { though: "do" };
    expect(applyUserAliasesToTranscript("though", vocab, aliases)).toBe("do");
    expect(applyUserAliasesToTranscript("uh texas", vocab, aliases)).toBe("uh Texas");
  });

  it("returns input when aliases empty", () => {
    expect(applyUserAliasesToTranscript("hello", ["hi"], {})).toBe("hello");
  });
});
