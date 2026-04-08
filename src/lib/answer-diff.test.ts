import { describe, expect, it } from "vitest";
import { diffGivenVsExpected } from "./answer-diff";

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
