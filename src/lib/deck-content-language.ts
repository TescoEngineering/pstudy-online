/** Language of deck content (community filter + deck editor). Distinct from UI locale. */

export const DECK_CONTENT_LANGUAGE_CODES = ["en", "de", "es", "fr", "it", "nl", "other"] as const;
export type DeckContentLanguageCode = (typeof DECK_CONTENT_LANGUAGE_CODES)[number];

export function isDeckContentLanguageCode(s: string): s is DeckContentLanguageCode {
  return (DECK_CONTENT_LANGUAGE_CODES as readonly string[]).includes(s);
}

/** Stored in DB as one code or two comma-separated (e.g. en / en,de). Order is preserved (e.g. L1 → L2). */
export const DECK_CONTENT_LANGUAGES_MAX = 2;

export function normalizeDeckContentLanguage(
  raw: string | null | undefined
): DeckContentLanguageCode | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "") return null;
  return isDeckContentLanguageCode(s) ? s : null;
}

/** Parse comma-separated codes from DB. Unknown segments are skipped; caps at {@link DECK_CONTENT_LANGUAGES_MAX}. */
export function parseDeckContentLanguages(raw: string | null | undefined): DeckContentLanguageCode[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (s === "") return [];
  const seen = new Set<DeckContentLanguageCode>();
  const out: DeckContentLanguageCode[] = [];
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

/** Join 1–2 unique codes for `decks.content_language`. Returns null if none. */
export function serializeDeckContentLanguages(
  codes: Iterable<DeckContentLanguageCode | null | undefined>
): string | null {
  const seen = new Set<DeckContentLanguageCode>();
  const out: DeckContentLanguageCode[] = [];
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
