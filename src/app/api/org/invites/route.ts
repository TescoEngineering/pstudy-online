import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail, isOrgAdmin } from "@/lib/org-admin";
import {
  generateOrgInviteToken,
  getOrgInviteAcceptUrl,
  normalizeOrgInviteEmail,
  orgInviteExpiresAt,
} from "@/lib/org-invites";
import type { OrganizationRole } from "@/types/organization";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    email?: string;
    role?: OrganizationRole;
  } | null;

  const organizationId = body?.organizationId?.trim();
  const email = normalizeOrgInviteEmail(body?.email ?? "");
  const role = body?.role;

  if (!organizationId) return bad("organizationId required");
  if (!email) return bad("Valid email required");
  if (role !== "student" && role !== "teacher" && role !== "admin") {
    return bad("role must be student, teacher, or admin");
  }

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id || !user.email) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  if (!(await isOrgAdmin(admin, user.id, organizationId))) {
    return bad("Not allowed", 403);
  }

  if (email === user.email.toLowerCase()) {
    return bad("Use another email address for invitations.");
  }

  const existingId = await findAuthUserIdByEmail(admin, email);
  if (existingId) {
    const { data: mem } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", existingId)
      .maybeSingle();
    if (mem) {
      return bad("This person is already a member of the school.");
    }
  }

  await admin
    .from("organization_invites")
    .update({ status: "revoked" })
    .eq("organization_id", organizationId)
    .eq("email", email)
    .eq("status", "pending");

  const access_token = generateOrgInviteToken();
  const expires_at = orgInviteExpiresAt();

  const { data: orgRow } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single();

  const orgName = orgRow?.name ?? "your school";

  const { error: insErr } = await admin.from("organization_invites").insert({
    organization_id: organizationId,
    email,
    role,
    access_token,
    status: "pending",
    invited_by: user.id,
    expires_at,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return bad("A pending invitation already exists for this email.");
    }
    return bad(insErr.message || "Could not create invitation", 500);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.CONTACT_FROM_EMAIL?.trim() || "PSTUDY <onboarding@resend.dev>";

  let emailed = false;
  if (apiKey) {
    const acceptUrl = getOrgInviteAcceptUrl(request, access_token);
    const subject = `PSTUDY: invitation to join “${orgName}”`;
    const text = [
      `You have been invited to join “${orgName}” on PSTUDY as a ${role}.`,
      "",
      "Open this link to accept (sign in or create an account with this email address):",
      acceptUrl,
      "",
      `This link expires in about 14 days.`,
      "",
      "— PSTUDY Online",
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
      }),
    }).catch(() => null);

    emailed = !!(res && res.ok);
  }

  return NextResponse.json({ ok: true, emailed });
}
