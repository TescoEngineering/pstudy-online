import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  inviteId: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function normalizeEmail(e: string | undefined | null): string {
  return (e ?? "").trim().toLowerCase();
}

/** Examinee removes an assignment from My assigned exams (revokes their own invite link). */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.inviteId) return bad("Missing inviteId");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const userEmail = normalizeEmail(user.email);
  if (!userEmail) return bad("Your account has no email; cannot verify this invite", 400);

  const admin = createAdminClient();
  if (!admin) return bad("SUPABASE_SERVICE_ROLE_KEY is missing", 500);

  const { data: invite, error: invErr } = await admin
    .from("exam_invites")
    .select("id,email,revoked_at")
    .eq("id", body.inviteId)
    .maybeSingle();

  if (invErr) return bad(invErr.message, 500);
  if (!invite) return bad("Invite not found", 404);

  if (normalizeEmail(invite.email) !== userEmail) return bad("Not allowed", 403);

  if (invite.revoked_at) {
    return NextResponse.json({ ok: true });
  }

  const { error: uErr } = await admin
    .from("exam_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.inviteId);

  if (uErr) return bad(uErr.message, 500);

  return NextResponse.json({ ok: true });
}
