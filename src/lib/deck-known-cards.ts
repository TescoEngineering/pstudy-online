/** Per-deck "I know this card" flags (browser localStorage; not synced across devices). */

function storageKey(deckId: string): string {
  return `pstudy-known-cards-${deckId}`;
}

export function getKnownItemIds(deckId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(deckId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function setItemKnown(deckId: string, itemId: string, known: boolean): void {
  if (typeof window === "undefined") return;
  const next = getKnownItemIds(deckId);
  if (known) next.add(itemId);
  else next.delete(itemId);
  localStorage.setItem(storageKey(deckId), JSON.stringify([...next]));
}

export function isItemKnown(deckId: string, itemId: string): boolean {
  return getKnownItemIds(deckId).has(itemId);
}

export function countKnownInDeck(deckId: string, itemIds: string[]): number {
  const known = getKnownItemIds(deckId);
  return itemIds.filter((id) => known.has(id)).length;
}
