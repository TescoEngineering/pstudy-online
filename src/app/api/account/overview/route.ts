import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AccountOverviewPayload } from "@/lib/account-overview";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type AttemptRow = {
  invite_id: string;
  status: "in_progress" | "submitted" | "expired";
  expires_at: string;
};

function examInviteIsActionable(attempt: AttemptRow | undefined): boolean {
  if (!attempt) return true;
  if (attempt.status === "submitted" || attempt.status === "expired") return false;
  if (attempt.status === "in_progress") {
    return new Date(attempt.expires_at).getTime() > Date.now();
  }
  return false;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const email = user.email?.trim() ?? null;

  const { data: deckRows, error: deckErr } = await supabase
    .from("decks")
    .select("id, is_public, quality_status")
    .eq("owner_id", user.id);

  if (deckErr) return bad(deckErr.message, 500);

  const rows = deckRows ?? [];
  const deckIds = rows.map((d) => d.id as string);

  let privateDecks = 0;
  let sharedDraft = 0;
  let sharedChecked = 0;
  for (const d of rows) {
    const pub = Boolean(d.is_public);
    if (!pub) {
      privateDecks++;
      continue;
    }
    if (d.quality_status === "checked") sharedChecked++;
    else sharedDraft++;
  }

  let itemsTotal = 0;
  if (deckIds.length > 0) {
    const { count, error: cErr } = await supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .in("deck_id", deckIds);
    if (cErr) return bad(cErr.message, 500);
    itemsTotal = count ?? 0;
  }

  const { count: examsIssued, error: eErr } = await supabase
    .from("exam_assignments")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if (eErr) return bad(eErr.message, 500);

  let examsToTake = 0;
  if (email) {
    const normalized = email.toLowerCase();
    const { data: myInvites, error: invErr } = await supabase
      .from("exam_invites")
      .select("id")
      .is("revoked_at", null)
      .ilike("email", normalized);
    if (invErr) return bad(invErr.message, 500);

    const inviteIds = (myInvites ?? []).map((r: { id: string }) => r.id);
    if (inviteIds.length > 0) {
      const { data: attempts, error: aErr } = await supabase
        .from("exam_attempts")
        .select("invite_id, status, expires_at")
        .in("invite_id", inviteIds);
      if (aErr) return bad(aErr.message, 500);

      const byInvite = new Map<string, AttemptRow>();
      for (const a of (attempts ?? []) as AttemptRow[]) {
        byInvite.set(a.invite_id, a);
      }

      for (const id of inviteIds) {
        if (examInviteIsActionable(byInvite.get(id))) examsToTake++;
      }
    }
  }

  const aiCreditsHint =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_AI_CREDITS_HINT?.trim()
      ? process.env.NEXT_PUBLIC_AI_CREDITS_HINT.trim()
      : null;

  const payload: AccountOverviewPayload = {
    email: user.email ?? null,
    memberSince: user.created_at ?? null,
    decks: {
      total: rows.length,
      private: privateDecks,
      sharedDraft,
      sharedChecked,
    },
    itemsTotal,
    examsIssued: examsIssued ?? 0,
    examsToTake,
    aiCreditsHint,
  };

  return NextResponse.json(payload);
}
