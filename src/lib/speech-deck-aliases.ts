/**
 * Per-deck STT → answer mappings (localStorage). Optional: map what the recognizer
 * returns (e.g. "though") to a deck answer (e.g. "do"). Used with "Consider only deck answers".
 */

const STORAGE_PREFIX = "pstudy-deck-stt-aliases:";

/** Same normalization as speech deck matching for keys. */
export function normalizeSttAliasKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.;:!?]+$/g, "");
}

export function loadDeckSttAliases(deckId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${deckId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const nk = normalizeSttAliasKey(k);
      if (typeof v === "string" && nk && v.trim()) out[nk] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDeckSttAliases(deckId: string, aliases: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(aliases)) {
      const nk = normalizeSttAliasKey(k);
      if (nk && v.trim()) normalized[nk] = v.trim();
    }
    localStorage.setItem(`${STORAGE_PREFIX}${deckId}`, JSON.stringify(normalized));
  } catch {
    // quota / private mode
  }
}
