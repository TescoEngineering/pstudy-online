import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicAppUrl } from "@/lib/deck-review";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { deckId?: string } | null;
  if (!body?.deckId?.trim()) return bad("deckId required");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.email) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const deckId = body.deckId.trim();

  const { data: deck, error: dErr } = await admin
    .from("decks")
    .select("id,title,owner_id,is_public,publication_status,review_status")
    .eq("id", deckId)
    .single();

  if (dErr || !deck) return bad("Deck not found", 404);
  if (deck.owner_id !== user.id) return bad("Not allowed", 403);
  if (!deck.is_public) return bad("Deck must be shared to resubmit review", 400);
  if (deck.publication_status !== "draft") return bad("Only drafts can be resubmitted for review", 400);
  if (deck.review_status !== "revise_and_resubmit") {
    return bad("No revision feedback is pending for this deck", 400);
  }

  const { data: invite, error: iErr } = await admin
    .from("deck_review_invites")
    .select("*")
    .eq("deck_id", deckId)
    .eq("status", "pending")
    .maybeSingle();

  if (iErr || !invite) return bad("No active review invite found", 400);

  const now = new Date().toISOString();
  const { error: uDeck } = await admin
    .from("decks")
    .update({ review_status: "resubmitted", updated_at: now })
    .eq("id", deckId);

  if (uDeck) return bad(uDeck.message || "Could not update deck", 500);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() || "PSTUDY <onboarding@resend.dev>";

  if (apiKey) {
    const reviewerEmail = invite.reviewer_email as string;
    const reviewUrl = `${getPublicAppUrl(request)}/review/${invite.access_token}`;
    const subject = `PSTUDY: “${deck.title}” resubmitted for review`;
    const text = [
      `${user.email} has resubmitted the deck “${deck.title}” after your feedback.`,
      "",
      "Open the review:",
      reviewUrl,
      "",
      "— PSTUDY Online",
    ].join("\n");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [reviewerEmail],
        subject,
        text,
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
