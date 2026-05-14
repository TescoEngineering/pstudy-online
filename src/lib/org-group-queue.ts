import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeOrgInviteEmail } from "@/lib/org-invites";

/**
 * After an org invite is accepted, add the user to any groups queued for the invited email.
 * Uses invite row email as the stable key (not the signed-in account email).
 */
export async function applyOrganizationGroupInviteQueue(
  admin: SupabaseClient,
  organizationId: string,
  invitedEmailRaw: string,
  acceptedUserId: string
): Promise<{ appliedGroupIds: string[] }> {
  const emailNorm = normalizeOrgInviteEmail(invitedEmailRaw);
  if (!emailNorm) return { appliedGroupIds: [] };

  const { data: pending, error } = await admin
    .from("organization_group_invite_queue")
    .select("id, group_id")
    .eq("organization_id", organizationId)
    .eq("email_normalized", emailNorm)
    .is("applied_at", null);

  if (error) throw error;
  const rows = pending ?? [];
  const appliedGroupIds: string[] = [];
  const now = new Date().toISOString();

  for (const row of rows as { id: string; group_id: string }[]) {
    const { error: insErr } = await admin.from("organization_group_members").insert({
      group_id: row.group_id,
      user_id: acceptedUserId,
    });
    if (insErr && insErr.code !== "23505") {
      throw insErr;
    }
    await admin
      .from("organization_group_invite_queue")
      .update({ applied_at: now })
      .eq("id", row.id);
    appliedGroupIds.push(row.group_id);
  }

  return { appliedGroupIds };
}
