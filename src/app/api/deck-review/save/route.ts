import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PStudyItem } from "@/types/pstudy";
import { validateReviewerItemPayload } from "@/lib/deck-review";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    items?: PStudyItem[];
  } | null;
  if (!body?.token?.trim() || !Array.isArray(body.items)) {
    return bad("token and items are required");
  }

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.email) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const { data: invite, error: iErr } = await admin
    .from("deck_review_invites")
    .select("*")
    .eq("access_token", body.token.trim())
    .eq("status", "pending")
    .maybeSingle();

  if (iErr || !invite) return bad("Review not found or no longer active", 404);
  if (invite.owner_id === user.id) return bad("Not allowed", 403);
  if (invite.reviewer_email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    return bad("Not allowed", 403);
  }

  const { data: deck, error: dErr } = await admin
    .from("decks")
    .select("id,is_public")
    .eq("id", invite.deck_id)
    .single();

  if (dErr || !deck?.is_public) return bad("Deck not available", 400);

  const { data: existingRows, error: eErr } = await admin
    .from("items")
    .select("id")
    .eq("deck_id", invite.deck_id)
    .order("order", { ascending: true });

  if (eErr) return bad(eErr.message, 500);
  const dbIds = (existingRows ?? []).map((r: { id: string }) => r.id);

  const check = validateReviewerItemPayload(dbIds, body.items);
  if (!check.ok) return bad(check.error);

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const row = {
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
    const { error: uErr } = await admin.from("items").update(row).eq("id", item.id);
    if (uErr) return bad(uErr.message || "Save failed", 500);
  }

  await admin
    .from("decks")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", invite.deck_id);

  return NextResponse.json({ ok: true });
}
