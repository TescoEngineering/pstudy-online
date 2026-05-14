import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail, isOrgAdmin, listOrgMembersWithEmails } from "@/lib/org-admin";
import { parseEmailPaste } from "@/lib/org-group-bulk";
import { ensurePendingOrgInvite } from "@/lib/org-invite-workflow";
import { normalizeOrgInviteEmail } from "@/lib/org-invites";
import type { OrganizationRole } from "@/types/organization";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function assertGroupInOrg(admin: SupabaseClient, groupId: string, organizationId: string) {
  const { data, error } = await admin
    .from("organization_groups")
    .select("id")
    .eq("id", groupId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

const DEFAULT_INVITE_ROLE: OrganizationRole = "student";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    paste?: string;
    confirmInvites?: boolean;
    inviteRole?: OrganizationRole;
  } | null;

  const organizationId = body?.organizationId?.trim();
  const paste = body?.paste ?? "";
  const confirmInvites = Boolean(body?.confirmInvites);
  const inviteRole =
    body?.inviteRole === "teacher" || body?.inviteRole === "admin" || body?.inviteRole === "student"
      ? body.inviteRole
      : DEFAULT_INVITE_ROLE;

  if (!organizationId) return bad("organizationId required");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  if (!(await isOrgAdmin(admin, user.id, organizationId))) {
    return bad("Not allowed", 403);
  }

  let ok: boolean;
  try {
    ok = await assertGroupInOrg(admin, groupId, organizationId);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "load failed", 500);
  }
  if (!ok) return bad("Group not found", 404);

  const { validEmails, invalidLineCount } = parseEmailPaste(paste);
  const members = await listOrgMembersWithEmails(admin, organizationId);
  const orgMemberIds = new Set(members.map((m) => m.userId));
  const emailToUserId = new Map<string, string>();
  for (const m of members) {
    const e = m.email ? normalizeOrgInviteEmail(m.email) : null;
    if (e) emailToUserId.set(e, m.userId);
  }

  const inOrgUserIds: string[] = [];
  const notInCommunity: string[] = [];
  const seenUser = new Set<string>();
  const seenEmail = new Set<string>();

  for (const em of validEmails) {
    const uid = emailToUserId.get(em);
    if (uid) {
      if (!seenUser.has(uid)) {
        seenUser.add(uid);
        inOrgUserIds.push(uid);
      }
    } else {
      const authId = await findAuthUserIdByEmail(admin, em);
      if (authId && orgMemberIds.has(authId)) {
        if (!seenUser.has(authId)) {
          seenUser.add(authId);
          inOrgUserIds.push(authId);
        }
        continue;
      }
      if (!seenEmail.has(em)) {
        seenEmail.add(em);
        notInCommunity.push(em);
      }
    }
  }

  let addedToGroup = 0;
  for (const user_id of inOrgUserIds) {
    const { error: oneErr } = await admin.from("organization_group_members").insert({ group_id: groupId, user_id });
    if (!oneErr) addedToGroup++;
    else if (oneErr.code !== "23505") return bad(oneErr.message || "Could not add member", 500);
  }

  let invitesCreated = 0;
  let invitesReused = 0;
  let invitesEmailed = 0;
  const queueErrors: string[] = [];

  if (notInCommunity.length > 0 && confirmInvites) {
    for (const email of notInCommunity) {
      if (email === user.email?.trim().toLowerCase()) {
        queueErrors.push(`${email}: cannot invite your own address`);
        continue;
      }
      const existingAuth = await findAuthUserIdByEmail(admin, email);
      if (existingAuth && orgMemberIds.has(existingAuth)) {
        continue;
      }
      if (existingAuth) {
        const { data: mem } = await admin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", organizationId)
          .eq("user_id", existingAuth)
          .maybeSingle();
        if (mem) continue;
      }

      try {
        const { reused, emailed } = await ensurePendingOrgInvite(admin, request, {
          organizationId,
          emailNormalized: email,
          role: inviteRole,
          invitedByUserId: user.id,
        });
        if (reused) invitesReused++;
        else invitesCreated++;
        if (emailed) invitesEmailed++;
      } catch (e) {
        queueErrors.push(`${email}: ${e instanceof Error ? e.message : "invite failed"}`);
        continue;
      }

      const { error: qErr } = await admin.from("organization_group_invite_queue").insert({
        organization_id: organizationId,
        group_id: groupId,
        email_normalized: email,
        queued_by: user.id,
      });
      if (qErr) {
        if (qErr.code === "23505") {
          /* already queued */
        } else {
          queueErrors.push(`${email}: ${qErr.message}`);
        }
      }
    }
  }

  return NextResponse.json({
    addedToGroup,
    invalidLineCount,
    invitesCreated,
    invitesReused,
    invitesEmailed,
    queueErrors,
  });
}
