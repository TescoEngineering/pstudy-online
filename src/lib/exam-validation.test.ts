import { describe, expect, it } from "vitest";
import { normalizeLenientAnswer } from "./exam-validation";

describe("normalizeLenientAnswer", () => {
  it("treats comma vs period after a word as equivalent (oral vs written French)", () => {
    const user = "Pardon, monsieur, où est le métro St. Michel?";
    const official = "Pardon, monsieur. Où est le métro St. Michel?";
    expect(normalizeLenientAnswer(user)).toBe(normalizeLenientAnswer(official));
  });

  it("still distinguishes different words", () => {
    expect(normalizeLenientAnswer("Bonjour")).not.toBe(normalizeLenientAnswer("Bonsoir"));
  });

  it("treats comma vs period and space before ? as equivalent (Saint-Michel both sides)", () => {
    const user = "Pardon, Monsieur, où est le métro Saint-Michel ?";
    const official = "Pardon, Monsieur. Où est le métro Saint-Michel?";
    expect(normalizeLenientAnswer(user)).toBe(normalizeLenientAnswer(official));
  });

  it("matches soft hyphen or zero-width space inside Saint-Michel (paste from Word/PDF)", () => {
    const official = "Pardon, Monsieur. Où est le métro Saint-Michel ?";
    const shy = "Pardon, Monsieur, où est le métro Saint\u00ADMichel ?";
    const zws = "Pardon, Monsieur, où est le métro Saint\u200BMichel ?";
    expect(normalizeLenientAnswer(shy)).toBe(normalizeLenientAnswer(official));
    expect(normalizeLenientAnswer(zws)).toBe(normalizeLenientAnswer(official));
  });

  it("treats Saint-Michel and St. Michel as equivalent (hyphen + abbreviation)", () => {
    const user = "Pardon, Monsieur, où est le métro Saint-Michel\u00a0?";
    const official = "Pardon, monsieur. Où est le métro St. Michel?";
    expect(normalizeLenientAnswer(user)).toBe(normalizeLenientAnswer(official));
  });

  it("matches same surface form with NB hyphen, narrow NBSP before ?, and decomposed où", () => {
    const user =
      "Pardon, Monsieur, o\u0075\u0300 est le métro Saint\u2011Michel\u202F?";
    const official = "Pardon, Monsieur. Où est le métro Saint-Michel?";
    expect(normalizeLenientAnswer(user)).toBe(normalizeLenientAnswer(official));
  });
});
