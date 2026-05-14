import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgMembershipRole, isOrgAdmin, listOrgMembersWithEmails, type OrgMemberRow } from "@/lib/org-admin";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim();
  if (!organizationId) return bad("organizationId required");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const role = await getOrgMembershipRole(admin, user.id, organizationId);
  if (role !== "admin" && role !== "teacher") {
    return bad("Not allowed", 403);
  }

  let ok: boolean;
  try {
    ok = await assertGroupInOrg(admin, groupId, organizationId);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "load failed", 500);
  }
  if (!ok) return bad("Group not found", 404);

  const { data: mrows, error: mErr } = await admin
    .from("organization_group_members")
    .select("user_id, added_at")
    .eq("group_id", groupId)
    .order("added_at", { ascending: true });
  if (mErr) return bad(mErr.message, 500);

  const membersFull = await listOrgMembersWithEmails(admin, organizationId);
  const byId = new Map(membersFull.map((m) => [m.userId, m]));

  const members: OrgMemberRow[] = [];
  for (const r of mrows ?? []) {
    const uid = (r as { user_id: string }).user_id;
    const base = byId.get(uid);
    if (base) members.push(base);
    else {
      members.push({
        userId: uid,
        email: null,
        role: "student",
        joinedAt: (r as { added_at: string }).added_at,
      });
    }
  }

  return NextResponse.json({ members });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    userIds?: string[];
  } | null;

  const organizationId = body?.organizationId?.trim();
  const userIds = Array.isArray(body?.userIds) ? body!.userIds!.filter((x) => typeof x === "string" && x) : [];
  if (!organizationId) return bad("organizationId required");
  if (userIds.length === 0) return bad("userIds required");

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

  const orgMemberIds = new Set(
    (await listOrgMembersWithEmails(admin, organizationId)).map((m) => m.userId)
  );

  const rows = userIds
    .filter((id, i, a) => a.indexOf(id) === i)
    .filter((id) => orgMemberIds.has(id))
    .map((user_id) => ({ group_id: groupId, user_id }));

  let added = 0;
  for (const row of rows) {
    const { error: oneErr } = await admin.from("organization_group_members").insert(row);
    if (!oneErr) added++;
    else if (oneErr.code !== "23505") return bad(oneErr.message || "Could not add members", 500);
  }

  return NextResponse.json({ added });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    userIds?: string[];
  } | null;

  const organizationId = body?.organizationId?.trim();
  const userIds = Array.isArray(body?.userIds) ? body!.userIds!.filter((x) => typeof x === "string" && x) : [];
  if (!organizationId) return bad("organizationId required");
  if (userIds.length === 0) return bad("userIds required");

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

  const { error: delErr } = await admin
    .from("organization_group_members")
    .delete()
    .eq("group_id", groupId)
    .in("user_id", userIds);

  if (delErr) return bad(delErr.message || "Could not remove members", 500);

  return NextResponse.json({ ok: true });
}
