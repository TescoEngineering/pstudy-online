import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicAppUrl } from "@/lib/deck-review";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    message?: string;
  } | null;
  if (!body?.token?.trim()) return bad("token required");

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
    .select("id,title,is_public,owner_id,publication_status")
    .eq("id", invite.deck_id)
    .single();

  if (dErr || !deck?.is_public) return bad("Deck not available", 400);
  if (deck.publication_status !== "draft") return bad("Only a draft can receive review feedback", 400);

  const note = typeof body.message === "string" ? body.message.trim() : "";
  const now = new Date().toISOString();

  const { error: uDeck } = await admin
    .from("decks")
    .update({ review_status: "revise_and_resubmit", updated_at: now })
    .eq("id", invite.deck_id);

  if (uDeck) return bad(uDeck.message || "Could not update deck", 500);

  const { error: uInv } = await admin
    .from("deck_review_invites")
    .update({ feedback_note: note || null })
    .eq("id", invite.id);

  if (uInv) return bad(uInv.message || "Could not save feedback", 500);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() || "PSTUDY <onboarding@resend.dev>";

  if (apiKey) {
    const { data: ownerAuth } = await admin.auth.admin.getUserById(deck.owner_id);
    const ownerEmail = ownerAuth.user?.email;
    if (ownerEmail) {
      const deckUrl = `${getPublicAppUrl(request)}/deck/${deck.id}`;
      const subject = `PSTUDY: feedback on your deck “${deck.title}”`;
      const text = [
        `${user.email} has feedback on your shared deck “${deck.title}”.`,
        note ? `\n${note}\n` : "",
        "Open your deck to revise and use “Resubmit for review” when ready:",
        deckUrl,
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
          to: [ownerEmail],
          subject,
          text,
        }),
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true });
}
