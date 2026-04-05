import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();
  if (!token) return bad("token required");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id || !user.email) return bad("You must be signed in to accept.", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const { data: invite, error: iErr } = await admin
    .from("organization_invites")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();

  if (iErr || !invite) return bad("Invitation not found", 404);

  if ((invite.status as string) !== "pending") {
    return bad("This invitation is no longer active", 410);
  }

  const exp = new Date(invite.expires_at as string).getTime();
  if (Number.isFinite(exp) && Date.now() > exp) {
    await admin
      .from("organization_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return bad("This invitation has expired", 410);
  }

  const inviteEmail = String(invite.email ?? "").trim().toLowerCase();
  if (user.email.trim().toLowerCase() !== inviteEmail) {
    return bad(
      "Sign in with the same email address this invitation was sent to, or use a different account after signing out.",
      403
    );
  }

  const organizationId = invite.organization_id as string;
  const role = invite.role as string;

  const { data: existing } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from("organization_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: user.id,
      })
      .eq("id", invite.id);
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const { error: insErr } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: user.id,
    role,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return bad("You are already a member of this school.");
    }
    if (insErr.message?.includes("member limit")) {
      return bad(insErr.message);
    }
    return bad(insErr.message || "Could not join the organization", 500);
  }

  await admin
    .from("organization_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: user.id,
    })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, alreadyMember: false });
}
