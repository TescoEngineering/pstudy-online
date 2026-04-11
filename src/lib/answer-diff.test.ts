import { describe, expect, it } from "vitest";
import { diffGivenVsExpected, diffGivenVsExpectedWordAware } from "./answer-diff";

describe("diffGivenVsExpected", () => {
  it("marks exact match as all ok", () => {
    const s = "Hello world";
    const segs = diffGivenVsExpected(s, s);
    expect(segs).toEqual([{ text: "Hello world", ok: true }]);
  });

  it("marks changed letter as wrong segment", () => {
    const segs = diffGivenVsExpected("Bonjour", "Bonsoir");
    expect(segs.some((s) => !s.ok)).toBe(true);
    expect(segs.map((s) => s.text).join("")).toBe("Bonjour");
  });

  it("handles empty given", () => {
    expect(diffGivenVsExpected("", "abc")).toEqual([]);
  });
});

describe("diffGivenVsExpectedWordAware", () => {
  it("does not insert a large omission gap after a multi-word wrong substitution before the next match", () => {
    const given =
      "Nous sommes au boulevard Sant-Michel, Lafontaine et là-bas.";
    const expected =
      "Nous sommes au boulevard Saint-Michel, La fontaine est là-bas.";
    const segs = diffGivenVsExpectedWordAware(given, expected);
    const joined = segs.map((s) => s.text).join("");
    expect(joined).toBe(given);
    expect(segs.some((s) => s.text.includes("\u00A0".repeat(4)))).toBe(false);
  });

  it("still shows omission gap when one wrong word is followed by several skipped expected words", () => {
    const given = "Mais Voilà le livre.";
    const expected = "Mais bien sûr! Voilà le livre.";
    const segs = diffGivenVsExpectedWordAware(given, expected);
    expect(segs.some((s) => !s.ok && s.text.includes("\u00A0"))).toBe(true);
  });
});
