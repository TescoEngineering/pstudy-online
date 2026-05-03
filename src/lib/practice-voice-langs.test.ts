import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import {
  defaultVoiceLangFromDeckContent,
  loadPracticeVoiceLangs,
  PRACTICE_VOICE_LANG_LS_PREFIX,
  resolvePracticeVoiceLangs,
  savePracticeVoiceLangs,
} from "@/lib/practice-voice-langs";

const memory: Record<string, string> = {};

const mockStorage = {
  get length() {
    return Object.keys(memory).length;
  },
  clear() {
    for (const k of Object.keys(memory)) delete memory[k];
  },
  getItem(key: string) {
    return memory[key] ?? null;
  },
  setItem(key: string, value: string) {
    memory[key] = String(value);
  },
  removeItem(key: string) {
    delete memory[key];
  },
  key(index: number) {
    return Object.keys(memory)[index] ?? null;
  },
} as Storage;

beforeAll(() => {
  vi.stubGlobal("localStorage", mockStorage);
  vi.stubGlobal("window", { localStorage: mockStorage } as unknown as Window);
});

describe("practice-voice-langs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults from deck content language", () => {
    localStorage.setItem("pstudy-speech-lang", "nl");
    expect(defaultVoiceLangFromDeckContent("de")).toBe("de");
  });

  it("falls back to legacy global when deck unset or other", () => {
    localStorage.setItem("pstudy-speech-lang", "nl");
    expect(defaultVoiceLangFromDeckContent(null)).toBe("nl");
    expect(defaultVoiceLangFromDeckContent("other")).toBe("nl");
  });

  it("persists deckContentLang snapshot with prefs", () => {
    savePracticeVoiceLangs("deck-1", "fr", "de", "de");
    const raw = localStorage.getItem(`${PRACTICE_VOICE_LANG_LS_PREFIX}deck-1`);
    expect(raw).toContain('"deckContentLang":"de"');
    expect(loadPracticeVoiceLangs("deck-1")).toEqual({
      listen: "fr",
      speak: "de",
      deckContentLang: "de",
    });
  });

  it("resolves legacy en/en to deck when deck is non-English and snapshot missing", () => {
    localStorage.setItem(
      `${PRACTICE_VOICE_LANG_LS_PREFIX}deck-1`,
      JSON.stringify({ listen: "en", speak: "en" })
    );
    const r = resolvePracticeVoiceLangs("nl", "deck-1");
    expect(r).toEqual({ listen: "nl", speak: "nl" });
  });

  it("resets prefs when deck content language snapshot changes", () => {
    savePracticeVoiceLangs("deck-1", "fr", "de", "fr");
    const r = resolvePracticeVoiceLangs("nl", "deck-1");
    expect(r).toEqual({ listen: "nl", speak: "nl" });
  });
});
