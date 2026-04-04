import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Deck, PStudyItem } from "@/types/pstudy";
import type { DbDeck, DbItem } from "@/lib/supabase/decks";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

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

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return bad("token required");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.email) return bad("Log in to open this review", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const { data: invite, error: iErr } = await admin
    .from("deck_review_invites")
    .select("*")
    .eq("access_token", token)
    .eq("status", "pending")
    .maybeSingle();

  if (iErr || !invite) return bad("Review not found or no longer active", 404);
  if (invite.owner_id === user.id) return bad("You cannot review your own deck", 403);
  if (invite.reviewer_email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
    return bad("This review was sent to a different email address", 403);
  }

  const { data: deckRow, error: dErr } = await admin
    .from("decks")
    .select("*")
    .eq("id", invite.deck_id)
    .single();

  if (dErr || !deckRow) return bad("Deck not found", 404);
  const d = deckRow as DbDeck;
  if (!d.is_public) return bad("This deck is no longer shared", 400);

  const { data: itemRows, error: itErr } = await admin
    .from("items")
    .select("*")
    .eq("deck_id", d.id)
    .order("order", { ascending: true });

  if (itErr) return bad(itErr.message, 500);

  const items = (itemRows as DbItem[]).map(dbItemToItem);
  const deck: Deck = {
    id: d.id,
    title: d.title,
    items,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    isPublic: d.is_public ?? false,
    fieldOfInterest: d.field_of_interest ?? null,
    topic: d.topic ?? null,
    publicationStatus:
      d.publication_status === "checked"
        ? "checked"
        : d.publication_status === "superseded"
          ? "superseded"
          : "draft",
    reviewStatus:
      d.review_status === "submitted"
        ? "submitted"
        : d.review_status === "revise_and_resubmit"
          ? "revise_and_resubmit"
          : d.review_status === "resubmitted"
            ? "resubmitted"
            : "none",
    lineageId: (d.lineage_id as string) ?? d.id,
    revisionNumber: d.revision_number ?? 1,
  };

  return NextResponse.json({ deck, inviteId: invite.id });
}
