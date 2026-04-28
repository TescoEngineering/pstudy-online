import { createClient } from "@/lib/supabase/client";

export type DeckSttAliasesRow = {
  user_id: string;
  lineage_id: string;
  aliases: Record<string, string>;
  updated_at: string;
};

export async function fetchDeckSttAliases(lineageId: string): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("deck_stt_aliases")
    .select("aliases")
    .eq("user_id", user.id)
    .eq("lineage_id", lineageId)
    .maybeSingle();

  if (error || !data) return {};
  const aliases = (data as { aliases?: unknown }).aliases;
  if (!aliases || typeof aliases !== "object") return {};
  return aliases as Record<string, string>;
}

export async function upsertDeckSttAliases(
  lineageId: string,
  aliases: Record<string, string>
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("deck_stt_aliases")
    .upsert(
      {
        user_id: user.id,
        lineage_id: lineageId,
        aliases,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lineage_id" }
    );
}

