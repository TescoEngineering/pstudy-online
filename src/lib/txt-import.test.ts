import { describe, expect, it } from "vitest";
import type { PStudyItem } from "@/types/pstudy";
import { buildPStudyTxtFileContents, generatePStudyTxt, parsePStudyTxt } from "./txt-import";

describe("parsePStudyTxt", () => {
  it("strips UTF-8 BOM so the first row parses", () => {
    const text = "\uFEFFhello\tworld\t\t\t\t\t\t\t";
    const { items } = parsePStudyTxt(text);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toBe("hello");
    expect(items[0]?.explanation).toBe("world");
  });

  it("ignores # comment lines (export header) while preserving legacy rows", () => {
    const text = [
      "# PSTUDY deck export",
      "# comment",
      "a\tb\tc1\tc2\tc3\tc4\t\tinst\tkw",
    ].join("\n");
    const { items } = parsePStudyTxt(text);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toBe("a");
    expect(items[0]?.multiplechoice1).toBe("c1");
    expect(items[0]?.instruction).toBe("inst");
    expect(items[0]?.keywords).toBe("kw");
  });

  it("round-trips export file → parse (same fields, same order)", () => {
    const items: PStudyItem[] = [
      {
        id: "keep-id",
        description: "Q one",
        explanation: "A one",
        multiplechoice1: "d1",
        multiplechoice2: "d2",
        multiplechoice3: "d3",
        multiplechoice4: "d4",
        picture_url: "https://example.com/p.png",
        instruction: "Say it loud",
        keywords: "kw1; kw2",
      },
      {
        id: "keep-id-2",
        description: "Q\ntwo",
        explanation: "A\ttwo",
        multiplechoice1: "",
        multiplechoice2: "",
        multiplechoice3: "",
        multiplechoice4: "",
        picture_url: "",
        instruction: "",
        keywords: "",
      },
    ];
    const file = buildPStudyTxtFileContents("My / Deck *", items);
    const { items: parsed } = parsePStudyTxt(file);
    expect(parsed.map((p) => p.description)).toEqual(["Q one", "Q two"]);
    expect(parsed.map((p) => p.explanation)).toEqual(["A one", "A two"]);
    expect(parsed.map((p) => p.multiplechoice1)).toEqual(["d1", ""]);
    expect(parsed.map((p) => p.picture_url)).toEqual(["https://example.com/p.png", ""]);
    expect(parsed.map((p) => p.instruction)).toEqual(["Say it loud", ""]);
    expect(parsed.map((p) => p.keywords)).toEqual(["kw1; kw2", ""]);
  });

  it("generatePStudyTxt matches parse for a simple row", () => {
    const items: PStudyItem[] = [
      {
        id: "1",
        description: "x",
        explanation: "y",
        multiplechoice1: "1",
        multiplechoice2: "2",
        multiplechoice3: "3",
        multiplechoice4: "4",
        picture_url: "",
        instruction: "i",
        keywords: "k",
      },
    ];
    const { items: out } = parsePStudyTxt(generatePStudyTxt(items));
    expect(out[0]?.description).toBe("x");
    expect(out[0]?.keywords).toBe("k");
  });
});
