import type { Deck } from "@/types/pstudy";

/** How long a deck list is reused without hitting Supabase (mutations invalidate earlier). */
const LIST_TTL_MS = 1000 * 60 * 30;

type ListCache = { userId: string; decks: Deck[]; cachedAt: number };

let listCache: ListCache | null = null;

function cloneDeck(d: Deck): Deck {
  return {
    ...d,
    items: d.items.map((it) => ({ ...it })),
  };
}

/** Drop cached list (call after any deck/items mutation). */
export function invalidateOwnedDecksListCache(): void {
  listCache = null;
}

export function getCachedOwnedDecksList(userId: string): Deck[] | null {
  if (!listCache || listCache.userId !== userId) return null;
  if (Date.now() - listCache.cachedAt > LIST_TTL_MS) {
    listCache = null;
    return null;
  }
  return listCache.decks.map(cloneDeck);
}

export function getCachedOwnedDeck(userId: string, deckId: string): Deck | null {
  if (!listCache || listCache.userId !== userId) return null;
  if (Date.now() - listCache.cachedAt > LIST_TTL_MS) {
    listCache = null;
    return null;
  }
  const d = listCache.decks.find((x) => x.id === deckId);
  if (!d) return null;
  if (d.itemsLoaded === false) return null;
  return cloneDeck(d);
}

export function setCachedOwnedDecksList(userId: string, decks: Deck[]): void {
  listCache = {
    userId,
    decks: decks.map(cloneDeck),
    cachedAt: Date.now(),
  };
}
