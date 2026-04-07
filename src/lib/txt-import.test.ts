import { describe, expect, it } from "vitest";
import { parsePStudyTxt } from "./txt-import";

describe("parsePStudyTxt", () => {
  it("strips UTF-8 BOM so the first row parses", () => {
    const text = "\uFEFFhello\tworld\t\t\t\t\t\t\t";
    const { items } = parsePStudyTxt(text);
    expect(items).toHaveLength(1);
    expect(items[0]?.description).toBe("hello");
    expect(items[0]?.explanation).toBe("world");
  });
});
