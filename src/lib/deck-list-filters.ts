import type { Deck } from "@/types/pstudy";
import type { PublicDecksFilters } from "@/lib/supabase/decks";
import { isDeckContentLanguageCode } from "@/lib/deck-content-language";

/** Match one filter code against stored `content_language` (same rules as PostgREST or() in {@link fetchPublicDecks}). */
function rawContentLanguageMatchesCode(raw: string, code: string): boolean {
  const c = code.trim().toLowerCase();
  if (!isDeckContentLanguageCode(c)) return false;
  const s = raw.trim().toLowerCase();
  if (s === c) return true;
  if (s.startsWith(`${c},`)) return true;
  if (s.endsWith(`,${c}`)) return true;
  return false;
}

/**
 * Client-side mirror of {@link fetchPublicDecks} filter semantics for in-memory deck lists (e.g. My decks).
 */
export function deckMatchesPublicDeckFilters(
  deck: Deck,
  filters: PublicDecksFilters
): boolean {
  const search = filters.search?.trim();
  if (search) {
    if (!deck.title.toLowerCase().includes(search.toLowerCase())) return false;
  }
  if (filters.fieldOfInterest) {
    if (deck.fieldOfInterest !== filters.fieldOfInterest) return false;
  }
  if (filters.topic) {
    if (deck.topic !== filters.topic) return false;
  }

  const langs =
    filters.languages?.filter((c) => typeof c === "string" && c.trim().length > 0) ?? [];
  if (langs.length > 0) {
    const includeUnspecified = filters.includeUnspecifiedLanguage !== false;
    const raw = deck.contentLanguage;
    const empty = raw == null || String(raw).trim() === "";
    if (empty) {
      if (!includeUnspecified) return false;
    } else {
      const str = String(raw);
      let matched = false;
      for (const rawLang of langs) {
        const code = rawLang.trim().toLowerCase();
        if (!isDeckContentLanguageCode(code)) continue;
        if (rawContentLanguageMatchesCode(str, code)) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
  }

  return true;
}

export function filterDecksByPublicDeckFilters(
  decks: Deck[],
  filters: PublicDecksFilters | undefined
): Deck[] {
  if (!filters || Object.keys(filters).length === 0) return [...decks];
  return decks.filter((d) => deckMatchesPublicDeckFilters(d, filters));
}
