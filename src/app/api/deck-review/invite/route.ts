import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateReviewAccessToken,
  getPublicAppUrl,
  normalizeReviewerEmail,
} from "@/lib/deck-review";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    deckId?: string;
    reviewerEmail?: string;
  } | null;
  if (!body?.deckId || !body.reviewerEmail?.trim()) {
    return bad("deckId and reviewerEmail are required");
  }

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.email) return bad("Not logged in", 401);

  const reviewerEmail = normalizeReviewerEmail(body.reviewerEmail);
  if (!reviewerEmail) return bad("Invalid reviewer email");
  if (reviewerEmail === user.email.toLowerCase()) {
    return bad("Choose a reviewer other than yourself");
  }

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const { data: deck, error: dErr } = await admin
    .from("decks")
    .select("id,owner_id,title,is_public,quality_status")
    .eq("id", body.deckId)
    .single();

  if (dErr || !deck) return bad("Deck not found", 404);
  if (deck.owner_id !== user.id) return bad("Not allowed", 403);
  if (!deck.is_public) return bad("Share the deck with the community before requesting a review");
  if (deck.quality_status === "checked") return bad("This deck is already marked as checked");

  await admin
    .from("deck_review_invites")
    .update({ status: "revoked" })
    .eq("deck_id", deck.id)
    .eq("status", "pending");

  const access_token = generateReviewAccessToken();
  const { data: invite, error: iErr } = await admin
    .from("deck_review_invites")
    .insert({
      deck_id: deck.id,
      owner_id: user.id,
      reviewer_email: reviewerEmail,
      access_token,
      status: "pending",
    })
    .select("*")
    .single();

  if (iErr) return bad(iErr.message || "Could not create invite", 500);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() || "PSTUDY <onboarding@resend.dev>";
  const reviewUrl = `${getPublicAppUrl(request)}/review/${access_token}`;

  if (apiKey) {
    const subject = `PSTUDY: review shared deck “${deck.title}”`;
    const text = [
      `${user.email} invites you to review and correct their shared PSTUDY deck “${deck.title}”.`,
      "",
      "Open the review (log in with this email address):",
      reviewUrl,
      "",
      "You can edit item text and images but not add or remove items. When finished, submit your corrections and mark the review complete. The author will be notified.",
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

  return NextResponse.json({
    ok: true,
    invite,
    reviewUrl,
    emailed: Boolean(apiKey),
  });
}
