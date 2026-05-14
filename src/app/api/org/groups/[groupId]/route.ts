import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrgAdmin } from "@/lib/org-admin";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function loadGroupOrg(admin: SupabaseClient, groupId: string) {
  const { data, error } = await admin
    .from("organization_groups")
    .select("id, organization_id, name, description, created_at, created_by")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    created_at: string;
    created_by: string | null;
  } | null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    name?: string;
    description?: string | null;
  } | null;

  const organizationId = body?.organizationId?.trim();
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

  let g: Awaited<ReturnType<typeof loadGroupOrg>>;
  try {
    g = await loadGroupOrg(admin, groupId);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "load failed", 500);
  }
  if (!g || g.organization_id !== organizationId) return bad("Group not found", 404);

  const patch: { name?: string; description?: string | null } = {};
  if (body?.name !== undefined) {
    const n = body.name.trim();
    if (!n) return bad("name cannot be empty");
    patch.name = n;
  }
  if (body?.description !== undefined) {
    patch.description = body.description === null || body.description === "" ? null : body.description.trim();
  }
  if (Object.keys(patch).length === 0) return bad("No changes");

  const { data: updated, error: upErr } = await admin
    .from("organization_groups")
    .update(patch)
    .eq("id", groupId)
    .eq("organization_id", organizationId)
    .select("id, organization_id, name, description, created_at, created_by")
    .single();

  if (upErr) {
    if (upErr.code === "23505") {
      return bad("A group with this name already exists in this organization.", 409);
    }
    return bad(upErr.message || "Could not update group", 500);
  }

  const { count } = await admin
    .from("organization_group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);

  return NextResponse.json({
    group: {
      ...updated,
      memberCount: count ?? 0,
    },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const organizationId =
    request.nextUrl.searchParams.get("organizationId")?.trim() ||
    ((await request.json().catch(() => null)) as { organizationId?: string } | null)?.organizationId?.trim();
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

  let g: Awaited<ReturnType<typeof loadGroupOrg>>;
  try {
    g = await loadGroupOrg(admin, groupId);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "load failed", 500);
  }
  if (!g || g.organization_id !== organizationId) return bad("Group not found", 404);

  const { error: delErr } = await admin.from("organization_groups").delete().eq("id", groupId);
  if (delErr) return bad(delErr.message || "Could not delete group", 500);

  return NextResponse.json({ ok: true });
}
