import { createClient } from "./client";
import { Deck, PStudyItem } from "@/types/pstudy";
import { isDeckContentLanguageCode } from "@/lib/deck-content-language";

export type DbDeck = {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  field_of_interest?: string | null;
  topic?: string | null;
  quality_status?: "draft" | "checked";
  content_language?: string | null;
};

export type DbItem = {
  id: string;
  deck_id: string;
  order: number;
  description: string;
  explanation: string;
  multiplechoice1: string;
  multiplechoice2: string;
  multiplechoice3: string;
  multiplechoice4: string;
  picture_url: string;
  instruction: string;
  keywords?: string;
};

/** Supabase may return NULL; whitespace-only should behave as empty for placeholders. */
function strFromDb(s: string | null | undefined): string {
  if (s == null) return "";
  const t = String(s);
  return t.trim() === "" ? "" : t;
}

function dbItemToItem(db: DbItem): PStudyItem {
  return {
    id: db.id,
    description: strFromDb(db.description),
    explanation: strFromDb(db.explanation),
    multiplechoice1: strFromDb(db.multiplechoice1),
    multiplechoice2: strFromDb(db.multiplechoice2),
    multiplechoice3: strFromDb(db.multiplechoice3),
    multiplechoice4: strFromDb(db.multiplechoice4),
    picture_url: strFromDb(db.picture_url),
    instruction: strFromDb(db.instruction),
    keywords: strFromDb(db.keywords),
  };
}

function dbDeckToDeck(db: DbDeck, items: PStudyItem[], includeOwner = false): Deck {
  const qs = db.quality_status;
  return {
    id: db.id,
    title: db.title,
    items,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    isPublic: db.is_public ?? false,
    fieldOfInterest: db.field_of_interest ?? null,
    topic: db.topic ?? null,
    contentLanguage: db.content_language ?? null,
    ...(qs === "draft" || qs === "checked" ? { qualityStatus: qs } : { qualityStatus: "draft" as const }),
    ...(includeOwner && { ownerId: db.owner_id }),
  };
}

export async function fetchDecks(): Promise<Deck[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: decks, error } = await supabase
    .from("decks")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!decks?.length) return [];

  const result: Deck[] = [];
  for (const d of decks) {
    const { data: items } = await supabase
      .from("items")
      .select("*")
      .eq("deck_id", d.id)
      .order("order");
    const itemList = (items ?? []).map(dbItemToItem);
    result.push(dbDeckToDeck(d, itemList));
  }
  return result;
}

export async function fetchDeck(id: string): Promise<Deck | null> {
  const supabase = createClient();
  const { data: deck, error } = await supabase
    .from("decks")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !deck) return null;

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("deck_id", id)
    .order("order");

  return dbDeckToDeck(deck, (items ?? []).map(dbItemToItem), false);
}

export type PublicDecksFilters = {
  search?: string;
  fieldOfInterest?: string | null;
  topic?: string | null;
  /** If non-empty, only decks whose `content_language` is in this list (and optionally unspecified — see below). */
  languages?: string[];
  /** When filtering by `languages`, also include decks with no `content_language` set. Default true. */
  includeUnspecifiedLanguage?: boolean;
  /**
   * If set, only decks whose stored pair has this code as the **second** language (`*,code` after comma).
   * Single-language decks do not match. Combined with {@link languages} via AND.
   */
  secondLanguage?: string | null;
};

/** Fetch public decks (for Community page) */
export async function fetchPublicDecks(filters?: PublicDecksFilters): Promise<Deck[]> {
  const supabase = createClient();
  let query = supabase
    .from("decks")
    .select("*")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (filters?.search?.trim()) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }
  if (filters?.fieldOfInterest) {
    query = query.eq("field_of_interest", filters.fieldOfInterest);
  }
  if (filters?.topic) {
    query = query.eq("topic", filters.topic);
  }

  const langs = filters?.languages?.filter((c) => typeof c === "string" && c.trim().length > 0) ?? [];
  if (langs.length > 0) {
    const includeUnspecified = filters?.includeUnspecifiedLanguage !== false;
    const langClauses: string[] = [];
    for (const raw of langs) {
      const code = raw.trim().toLowerCase();
      if (!isDeckContentLanguageCode(code)) continue;
      langClauses.push(`content_language.eq.${code}`);
      langClauses.push(`content_language.like."${code},%"`);
      langClauses.push(`content_language.like."%,${code}"`);
    }
    if (langClauses.length > 0) {
      const orBody = includeUnspecified
        ? `content_language.is.null,${langClauses.join(",")}`
        : langClauses.join(",");
      query = query.or(orBody);
    }
  }

  const secondRaw = filters?.secondLanguage?.trim();
  if (secondRaw) {
    const code = secondRaw.toLowerCase();
    if (isDeckContentLanguageCode(code)) {
      query = query.like("content_language", `%,${code}`);
    }
  }

  const { data: decks, error } = await query;

  if (error) throw error;
  if (!decks?.length) return [];

  const result: Deck[] = [];
  for (const d of decks) {
    const { data: items } = await supabase
      .from("items")
      .select("*")
      .eq("deck_id", d.id)
      .order("order");
    const itemList = (items ?? []).map(dbItemToItem);
    result.push(dbDeckToDeck(d, itemList, true));
  }
  return result;
}

/** Stable error code for UI copy; checked decks cannot be edited. */
export const DECK_CHECKED_READONLY = "DECK_CHECKED_READONLY";

/** Duplicate a deck you own (e.g. checked deck you cannot edit). New deck is private draft. */
export async function duplicateOwnedDeck(deckId: string): Promise<Deck> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: row, error: rowErr } = await supabase
    .from("decks")
    .select("owner_id")
    .eq("id", deckId)
    .single();
  if (rowErr || !row || row.owner_id !== user.id) {
    throw new Error("Deck not found or access denied");
  }

  const sourceDeck = await fetchDeck(deckId);
  if (!sourceDeck) throw new Error("Deck not found");

  const newDeck = await createDeck(`Copy of ${sourceDeck.title}`);
  const itemsWithNewIds: PStudyItem[] = sourceDeck.items.map((it) => ({
    ...it,
    id: crypto.randomUUID(),
  }));
  const deckWithItems: Deck = {
    ...newDeck,
    items: itemsWithNewIds,
    fieldOfInterest: sourceDeck.fieldOfInterest ?? null,
    topic: sourceDeck.topic ?? null,
    contentLanguage: sourceDeck.contentLanguage ?? null,
    isPublic: false,
  };
  await saveDeckWithItems(deckWithItems);
  await supabase.from("decks").update({ quality_status: "draft" }).eq("id", newDeck.id);

  const fresh = await fetchDeck(newDeck.id);
  return fresh ?? deckWithItems;
}

/** Copy a public deck to the current user's decks */
export async function copyDeckToMine(deckId: string): Promise<Deck> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const sourceDeck = await fetchDeck(deckId);
  if (!sourceDeck) throw new Error("Deck not found");
  if (!sourceDeck.isPublic) throw new Error("This deck is not shared");

  const newDeck = await createDeck(`Copy of ${sourceDeck.title}`);
  const itemsWithNewIds: PStudyItem[] = sourceDeck.items.map((it) => ({
    ...it,
    id: crypto.randomUUID(),
  }));
  const deckWithItems: Deck = {
    ...newDeck,
    items: itemsWithNewIds,
    fieldOfInterest: sourceDeck.fieldOfInterest,
    topic: sourceDeck.topic,
    contentLanguage: sourceDeck.contentLanguage ?? null,
  };
  await saveDeckWithItems(deckWithItems);
  await supabase.from("decks").update({ quality_status: "draft" }).eq("id", newDeck.id);
  return { ...deckWithItems, qualityStatus: "draft" as const };
}

/** Concatenate items from several decks into one new deck. Preserves `sourceDeckIds` order; assigns new item IDs. Original decks are unchanged. Copies field/topic from the first source. */
export async function mergeDecksIntoNew(sourceDeckIdsInOrder: string[], title: string): Promise<Deck> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const seen = new Set<string>();
  const orderedIds: string[] = [];
  for (const id of sourceDeckIdsInOrder) {
    if (!seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }
  }
  if (orderedIds.length < 2) throw new Error("Select at least two decks to merge");

  const sources: Deck[] = [];
  for (const id of orderedIds) {
    const { data: row, error: rowErr } = await supabase
      .from("decks")
      .select("owner_id")
      .eq("id", id)
      .single();
    if (rowErr || !row || row.owner_id !== user.id) {
      throw new Error("Deck not found or access denied");
    }
    const deck = await fetchDeck(id);
    if (!deck) throw new Error("Deck not found");
    sources.push(deck);
  }

  const mergedItems: PStudyItem[] = [];
  for (const d of sources) {
    for (const it of d.items) {
      mergedItems.push({ ...it, id: crypto.randomUUID() });
    }
  }

  const first = sources[0]!;
  const safeTitle = title.trim() || "Merged deck";
  const newDeck = await createDeck(safeTitle);
  const deckWithItems: Deck = {
    ...newDeck,
    title: safeTitle,
    items: mergedItems,
    isPublic: false,
    fieldOfInterest: first.fieldOfInterest ?? null,
    topic: first.topic ?? null,
    contentLanguage: first.contentLanguage ?? null,
  };
  await saveDeckWithItems(deckWithItems);
  await supabase.from("decks").update({ quality_status: "draft" }).eq("id", newDeck.id);

  const fresh = await fetchDeck(newDeck.id);
  return fresh ?? deckWithItems;
}

export async function createDeck(title: string = "Untitled deck"): Promise<Deck> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: deck, error } = await supabase
    .from("decks")
    .insert({
      owner_id: user.id,
      title,
    })
    .select()
    .single();

  if (error) throw error;
  return dbDeckToDeck(deck, [], false);
}

export async function updateDeck(
  id: string,
  updates: {
    title?: string;
    is_public?: boolean;
    field_of_interest?: string | null;
    topic?: string | null;
    content_language?: string | null;
  }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("decks")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteDeck(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("decks").delete().eq("id", id);
  if (error) throw error;
}

export async function saveDeckWithItems(deck: Deck): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: meta, error: metaErr } = await supabase
    .from("decks")
    .select("owner_id, quality_status")
    .eq("id", deck.id)
    .single();
  if (metaErr || !meta) throw new Error("Deck not found");
  if (meta.owner_id !== user.id) throw new Error("Not allowed");
  if (meta.quality_status === "checked") {
    throw new Error(DECK_CHECKED_READONLY);
  }

  await supabase
    .from("decks")
    .update({
      title: deck.title,
      updated_at: new Date().toISOString(),
      ...(deck.isPublic !== undefined && { is_public: deck.isPublic }),
      ...(deck.fieldOfInterest !== undefined && { field_of_interest: deck.fieldOfInterest }),
      ...(deck.topic !== undefined && { topic: deck.topic }),
      ...(deck.contentLanguage !== undefined && { content_language: deck.contentLanguage }),
    })
    .eq("id", deck.id);

  const { data: existing } = await supabase
    .from("items")
    .select("id")
    .eq("deck_id", deck.id);

  const existingIds = new Set((existing ?? []).map((r) => r.id));

  for (let i = 0; i < deck.items.length; i++) {
    const item = deck.items[i];
    const row = {
      deck_id: deck.id,
      order: i,
      description: item.description,
      explanation: item.explanation,
      multiplechoice1: item.multiplechoice1,
      multiplechoice2: item.multiplechoice2,
      multiplechoice3: item.multiplechoice3,
      multiplechoice4: item.multiplechoice4,
      picture_url: item.picture_url,
      instruction: item.instruction,
      keywords: item.keywords ?? "",
    };

    if (existingIds.has(item.id)) {
      await supabase.from("items").update(row).eq("id", item.id);
    } else {
      const { data: inserted } = await supabase
        .from("items")
        .insert({ ...row, id: item.id })
        .select("id")
        .single();
      if (inserted) existingIds.add(inserted.id);
    }
  }

  const toDelete = Array.from(existingIds).filter(
    (id) => !deck.items.some((it) => it.id === id)
  );
  if (toDelete.length > 0) {
    await supabase.from("items").delete().in("id", toDelete);
  }
}

export async function addItemToDeck(deckId: string, item: PStudyItem, order: number): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { data: meta } = await supabase
    .from("decks")
    .select("owner_id, quality_status")
    .eq("id", deckId)
    .single();
  if (!meta || meta.owner_id !== user.id) throw new Error("Not allowed");
  if (meta.quality_status === "checked") throw new Error(DECK_CHECKED_READONLY);

  const { data, error } = await supabase
    .from("items")
    .insert({
      id: item.id,
      deck_id: deckId,
      order,
      description: item.description,
      explanation: item.explanation,
      multiplechoice1: item.multiplechoice1,
      multiplechoice2: item.multiplechoice2,
      multiplechoice3: item.multiplechoice3,
      multiplechoice4: item.multiplechoice4,
      picture_url: item.picture_url,
      instruction: item.instruction,
      keywords: item.keywords ?? "",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
