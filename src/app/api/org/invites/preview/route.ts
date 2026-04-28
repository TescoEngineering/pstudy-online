import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Public preview for invite page (no auth): org name + role + email domain hints only. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return bad("token required");

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const { data: invite, error } = await admin
    .from("organization_invites")
    .select("email, role, expires_at, status, organization_id, organizations(name)")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !invite) return bad("Invitation not found", 404);

  const st = invite.status as string;
  if (st !== "pending") return bad("This invitation is no longer active", 410);

  const exp = new Date(invite.expires_at as string).getTime();
  if (Number.isFinite(exp) && Date.now() > exp) {
    return bad("This invitation has expired", 410);
  }

  const org = invite.organizations as { name: string } | { name: string }[] | null;
  let orgName = Array.isArray(org) ? org[0]?.name : org?.name;
  if (!orgName && invite.organization_id) {
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name")
      .eq("id", invite.organization_id as string)
      .maybeSingle();
    orgName = orgRow?.name as string | undefined;
  }
  const email = String(invite.email ?? "");
  const [local, domain] = email.includes("@") ? email.split("@") : [email, ""];
  const emailHint =
    local.length > 0 && domain
      ? `${local[0] ?? "?"}•••@${domain}`
      : "•••";

  return NextResponse.json({
    organizationName: orgName ?? "School",
    role: invite.role,
    emailHint,
  });
}
