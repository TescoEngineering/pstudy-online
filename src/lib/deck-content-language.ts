/** Language of deck content (community filter + deck editor). Distinct from UI locale. */

import { SPEECH_LANGUAGES } from "@/lib/speech-languages";

const CANONICAL_BY_LOWER = new Map<string, string>();

/**
 * BCP-47 tags from practice/speak {@link SPEECH_LANGUAGES} plus `other` for mixed / not listed.
 * The deck editor stores a single BCP-47 code (or `other`). Legacy rows may have carried an extra
 * comma-suffix; parsing keeps at most one code.
 */
export const DECK_CONTENT_LANGUAGE_CODES: readonly string[] = (() => {
  const c: string[] = [];
  for (const l of SPEECH_LANGUAGES) {
    c.push(l.code);
    CANONICAL_BY_LOWER.set(l.code.toLowerCase(), l.code);
  }
  c.push("other");
  CANONICAL_BY_LOWER.set("other", "other");
  return c;
})();

const VALID_CANONICAL = new Set(DECK_CONTENT_LANGUAGE_CODES);

export type DeckContentLanguageCode = string;

export function isDeckContentLanguageCode(s: string): boolean {
  return normalizeDeckContentLanguage(s) != null;
}

/** Label for select options: speak list English names, `other` from i18n. */
export function getDeckContentLanguageLabel(
  code: string,
  t: (key: string) => string
): string {
  if (code === "other") return t("deck.contentLang_other");
  const fromSpeech = SPEECH_LANGUAGES.find((l) => l.code === code);
  if (fromSpeech) return fromSpeech.name;
  const key = `deck.contentLang_${code}`;
  const tr = t(key);
  return tr !== key ? tr : code;
}

export const DECK_CONTENT_LANGUAGES_MAX = 1;

export function normalizeDeckContentLanguage(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  const fromLower = CANONICAL_BY_LOWER.get(s.toLowerCase());
  if (fromLower) return fromLower;
  return VALID_CANONICAL.has(s) ? s : null;
}

/** Parse comma-separated codes from DB. Unknown segments are skipped; caps at one code. */
export function parseDeckContentLanguages(raw: string | null | undefined): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (s === "") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(",")) {
    const code = normalizeDeckContentLanguage(part);
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
      if (out.length >= DECK_CONTENT_LANGUAGES_MAX) break;
    }
  }
  return out;
}

/** Join one code for `decks.content_language`. Returns null if none. */
export function serializeDeckContentLanguages(
  codes: Iterable<DeckContentLanguageCode | null | undefined>
): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of codes) {
    if (c == null) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length >= DECK_CONTENT_LANGUAGES_MAX) break;
  }
  return out.length === 0 ? null : out.join(",");
}

export function deckContentLanguagesClassificationComplete(raw: string | null | undefined): boolean {
  return parseDeckContentLanguages(raw).length > 0;
}

/** PostgREST / Supabase `.or()` fragment value: quote strings with hyphens or special chars. */
export function postgrestQuotedFilterValue(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '""')}"`;
}
