import { createClient } from "./client";
import { Deck, PStudyItem } from "@/types/pstudy";

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
  };
  await saveDeckWithItems(deckWithItems);
  await supabase.from("decks").update({ quality_status: "draft" }).eq("id", newDeck.id);
  return { ...deckWithItems, qualityStatus: "draft" as const };
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
  updates: { title?: string; is_public?: boolean; field_of_interest?: string | null; topic?: string | null }
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  await supabase
    .from("decks")
    .update({
      title: deck.title,
      updated_at: new Date().toISOString(),
      ...(deck.isPublic !== undefined && { is_public: deck.isPublic }),
      ...(deck.fieldOfInterest !== undefined && { field_of_interest: deck.fieldOfInterest }),
      ...(deck.topic !== undefined && { topic: deck.topic }),
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
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
