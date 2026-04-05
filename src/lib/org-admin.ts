import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationRole } from "@/types/organization";

export async function isOrgAdmin(
  admin: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.role as string | undefined) === "admin";
}

export async function listAdminOrganizations(
  admin: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string; slug: string | null }[]> {
  const { data: rows, error } = await admin
    .from("organization_members")
    .select("organization_id, organizations(id, name, slug)")
    .eq("user_id", userId)
    .eq("role", "admin");

  if (error) throw error;
  type Row = {
    organization_id: string;
    organizations:
      | { id: string; name: string; slug: string | null }
      | { id: string; name: string; slug: string | null }[]
      | null;
  };
  const out: { id: string; name: string; slug: string | null }[] = [];
  for (const r of (rows ?? []) as Row[]) {
    const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    if (o) out.push({ id: o.id, name: o.name, slug: o.slug ?? null });
  }
  return out;
}

/** Auth Admin: find user id by email (linear scan; fine for typical school sizes). */
export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target);
    if (u) return u.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

export async function countAdminsInOrg(
  admin: SupabaseClient,
  organizationId: string
): Promise<number> {
  const { count, error } = await admin
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "admin");

  if (error) throw error;
  return count ?? 0;
}

export type OrgMemberRow = {
  userId: string;
  email: string | null;
  role: OrganizationRole;
  joinedAt: string;
};

export async function listOrgMembersWithEmails(
  admin: SupabaseClient,
  organizationId: string
): Promise<OrgMemberRow[]> {
  const { data: members, error } = await admin
    .from("organization_members")
    .select("user_id, role, joined_at")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  const rows: OrgMemberRow[] = [];
  for (const m of members ?? []) {
    const uid = (m as { user_id: string }).user_id;
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(uid);
    if (authErr) {
      rows.push({
        userId: uid,
        email: null,
        role: (m as { role: OrganizationRole }).role,
        joinedAt: (m as { joined_at: string }).joined_at,
      });
      continue;
    }
    rows.push({
      userId: uid,
      email: authData.user?.email ?? null,
      role: (m as { role: OrganizationRole }).role,
      joinedAt: (m as { joined_at: string }).joined_at,
    });
  }
  return rows;
}
