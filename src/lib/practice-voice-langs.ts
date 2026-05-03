/**
 * Per-deck Listen (TTS) vs Speak (STT) locale prefs for Practice.
 */

import { parseDeckContentLanguages } from "@/lib/deck-content-language";
import { matchSpeechLanguageSelectValue } from "@/lib/speech-languages";

export const PRACTICE_VOICE_LANG_LS_PREFIX = "pstudy-practice-voice-v1:";
export const LEGACY_SPEECH_LANG_KEY = "pstudy-speech-lang";

/** Stable fingerprint of deck `content_language` for invalidating stale saved prefs. */
export function contentLangSnapshot(raw: string | null | undefined): string {
  const codes = parseDeckContentLanguages(raw);
  const c = codes[0];
  if (!c || c === "other") return "";
  return c;
}

export function readLegacySpeechLang(): string {
  if (typeof window === "undefined") return "en";
  try {
    const s = localStorage.getItem(LEGACY_SPEECH_LANG_KEY)?.trim();
    const m = s ? matchSpeechLanguageSelectValue(s) : "";
    return m && m !== "other" && m !== "" ? m : "en";
  } catch {
    return "en";
  }
}

/** Primary BCP-47-ish code from deck classification “Content language”, else legacy browser default. */
export function defaultVoiceLangFromDeckContent(
  contentLanguage: string | null | undefined
): string {
  const codes = parseDeckContentLanguages(contentLanguage);
  const c = codes[0];
  if (!c || c === "other") return readLegacySpeechLang();
  const m = matchSpeechLanguageSelectValue(c);
  return m && m !== "other" && m !== "" ? m : readLegacySpeechLang();
}

export function practiceVoiceLangStorageKey(lineageId: string | undefined, deckId: string): string {
  return lineageId?.trim() ? lineageId.trim() : deckId;
}

export type LoadedPracticeVoiceLangs = {
  listen: string;
  speak: string;
  /** Snapshot of deck `content_language` when prefs were saved. */
  deckContentLang?: string;
};

export function loadPracticeVoiceLangs(storageKey: string): LoadedPracticeVoiceLangs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRACTICE_VOICE_LANG_LS_PREFIX + storageKey);
    if (!raw?.trim()) return null;
    const j = JSON.parse(raw) as {
      listen?: unknown;
      speak?: unknown;
      deckContentLang?: unknown;
    };
    const listen =
      typeof j.listen === "string" ? matchSpeechLanguageSelectValue(j.listen) : "";
    const speak =
      typeof j.speak === "string" ? matchSpeechLanguageSelectValue(j.speak) : "";
    if (!listen || listen === "other" || !speak || speak === "other") return null;
    const deckContentLang =
      typeof j.deckContentLang === "string" ? j.deckContentLang : undefined;
    return { listen, speak, deckContentLang };
  } catch {
    return null;
  }
}

/**
 * Decide listen/speak for this deck: saved prefs unless the deck’s content language changed
 * or legacy “en/en” clearly predates setting a non-English deck language.
 */
export function resolvePracticeVoiceLangs(
  deckContentLanguageRaw: string | null | undefined,
  storageKey: string
): { listen: string; speak: string } {
  const base = defaultVoiceLangFromDeckContent(deckContentLanguageRaw);
  const snap = contentLangSnapshot(deckContentLanguageRaw);
  const loaded = loadPracticeVoiceLangs(storageKey);
  if (!loaded) {
    return { listen: base, speak: base };
  }
  if (loaded.deckContentLang != null && loaded.deckContentLang !== snap) {
    return { listen: base, speak: base };
  }
  if (loaded.deckContentLang == null && snap && snap !== "") {
    if (loaded.listen === "en" && loaded.speak === "en" && base !== "en") {
      return { listen: base, speak: base };
    }
  }
  return { listen: loaded.listen, speak: loaded.speak };
}

export function savePracticeVoiceLangs(
  storageKey: string,
  listen: string,
  speak: string,
  deckContentLanguageRaw?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const deckContentLang = contentLangSnapshot(
      deckContentLanguageRaw === undefined ? null : deckContentLanguageRaw
    );
    localStorage.setItem(
      PRACTICE_VOICE_LANG_LS_PREFIX + storageKey,
      JSON.stringify({
        listen,
        speak,
        deckContentLang,
      })
    );
    localStorage.setItem(LEGACY_SPEECH_LANG_KEY, speak);
  } catch {
    /* ignore */
  }
}
