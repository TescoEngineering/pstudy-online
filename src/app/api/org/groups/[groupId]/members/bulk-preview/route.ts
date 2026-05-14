import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrgAdmin, listOrgMembersWithEmails } from "@/lib/org-admin";
import { parseEmailPaste } from "@/lib/org-group-bulk";
import { normalizeOrgInviteEmail } from "@/lib/org-invites";

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    paste?: string;
  } | null;

  const organizationId = body?.organizationId?.trim();
  const paste = body?.paste ?? "";
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
  const emailToUserId = new Map<string, string>();
  for (const m of members) {
    const e = m.email ? normalizeOrgInviteEmail(m.email) : null;
    if (e) emailToUserId.set(e, m.userId);
  }

  const inOrg: { userId: string; email: string }[] = [];
  const notInCommunity: string[] = [];
  const seenOut = new Set<string>();

  for (const em of validEmails) {
    const uid = emailToUserId.get(em);
    if (uid) {
      inOrg.push({ userId: uid, email: em });
    } else if (!seenOut.has(em)) {
      seenOut.add(em);
      notInCommunity.push(em);
    }
  }

  return NextResponse.json({
    inOrg,
    notInCommunity,
    invalidLineCount,
  });
}
