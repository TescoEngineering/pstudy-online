import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgMembershipRole, isOrgAdmin } from "@/lib/org-admin";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
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
  if (!role) return bad("Not allowed", 403);

  if (role === "student") {
    const { data: myRows, error: mErr } = await admin
      .from("organization_group_members")
      .select("group_id")
      .eq("user_id", user.id);
    if (mErr) return bad(mErr.message, 500);
    const gids = [...new Set((myRows ?? []).map((r: { group_id: string }) => r.group_id))];
    if (gids.length === 0) return NextResponse.json({ groups: [] });

    const { data: groups, error: gErr } = await admin
      .from("organization_groups")
      .select("id, name, description")
      .eq("organization_id", organizationId)
      .in("id", gids)
      .order("name", { ascending: true });
    if (gErr) return bad(gErr.message, 500);
    return NextResponse.json({ groups: groups ?? [] });
  }

  if (role === "teacher" || role === "admin") {
    const { data: groups, error } = await admin
      .from("organization_groups")
      .select("id, organization_id, name, description, created_at, created_by")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true });
    if (error) return bad(error.message, 500);

    const out: {
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      createdAt: string;
      createdBy: string | null;
      memberCount: number;
    }[] = [];

    for (const g of groups ?? []) {
      const row = g as {
        id: string;
        organization_id: string;
        name: string;
        description: string | null;
        created_at: string;
        created_by: string | null;
      };
      const { count, error: cErr } = await admin
        .from("organization_group_members")
        .select("*", { count: "exact", head: true })
        .eq("group_id", row.id);
      if (cErr) return bad(cErr.message, 500);
      out.push({
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at,
        createdBy: row.created_by,
        memberCount: count ?? 0,
      });
    }
    return NextResponse.json({ groups: out });
  }

  return bad("Not allowed", 403);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    name?: string;
    description?: string | null;
  } | null;

  const organizationId = body?.organizationId?.trim();
  const name = body?.name?.trim() ?? "";
  const description = body?.description?.trim() || null;

  if (!organizationId) return bad("organizationId required");
  if (!name) return bad("name required");

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

  const { data: inserted, error: insErr } = await admin
    .from("organization_groups")
    .insert({
      organization_id: organizationId,
      name,
      description,
      created_by: user.id,
    })
    .select("id, organization_id, name, description, created_at, created_by")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return bad("A group with this name already exists in this organization.", 409);
    }
    return bad(insErr.message || "Could not create group", 500);
  }

  return NextResponse.json({ group: { ...inserted, memberCount: 0 } });
}
