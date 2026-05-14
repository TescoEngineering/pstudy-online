import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateOrgInviteToken,
  getOrgInviteAcceptUrl,
  normalizeOrgInviteEmail,
  orgInviteExpiresAt,
} from "@/lib/org-invites";
import type { OrganizationRole } from "@/types/organization";

export type PendingOrgInviteRow = {
  id: string;
  access_token: string;
  email: string;
  role: OrganizationRole;
  status: string;
};

/** Pending invite for this org + email (normalized), if any. */
export async function findPendingOrgInvite(
  admin: SupabaseClient,
  organizationId: string,
  emailNormalized: string
): Promise<PendingOrgInviteRow | null> {
  const { data, error } = await admin
    .from("organization_invites")
    .select("id, access_token, email, role, status")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .eq("email", emailNormalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return data as PendingOrgInviteRow;
}

export async function sendOrgInviteResendEmail(
  request: NextRequest,
  email: string,
  orgName: string,
  role: OrganizationRole,
  accessToken: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || "PSTUDY <onboarding@resend.dev>";
  if (!apiKey) return false;

  const acceptUrl = getOrgInviteAcceptUrl(request, accessToken);
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

  return !!(res && res.ok);
}

/**
 * Ensure there is a pending org invite for this email. If one exists, reuse it (no new email).
 * Otherwise revoke stale pendings for this email+org, insert a new invite, and send email.
 */
export async function ensurePendingOrgInvite(
  admin: SupabaseClient,
  request: NextRequest,
  params: {
    organizationId: string;
    emailNormalized: string;
    role: OrganizationRole;
    invitedByUserId: string;
  }
): Promise<{ reused: boolean; emailed: boolean }> {
  const { organizationId, emailNormalized, role, invitedByUserId } = params;

  const existing = await findPendingOrgInvite(admin, organizationId, emailNormalized);
  if (existing) {
    return { reused: true, emailed: false };
  }

  await admin
    .from("organization_invites")
    .update({ status: "revoked" })
    .eq("organization_id", organizationId)
    .eq("email", emailNormalized)
    .eq("status", "pending");

  const access_token = generateOrgInviteToken();
  const expires_at = orgInviteExpiresAt();

  const { data: orgRow } = await admin.from("organizations").select("name").eq("id", organizationId).single();

  const orgName = orgRow?.name ?? "your organization";

  const { error: insErr } = await admin.from("organization_invites").insert({
    organization_id: organizationId,
    email: emailNormalized,
    role,
    access_token,
    status: "pending",
    invited_by: invitedByUserId,
    expires_at,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      const again = await findPendingOrgInvite(admin, organizationId, emailNormalized);
      if (again) return { reused: true, emailed: false };
    }
    throw insErr;
  }

  const emailed = await sendOrgInviteResendEmail(request, emailNormalized, orgName, role, access_token);
  return { reused: false, emailed };
}
