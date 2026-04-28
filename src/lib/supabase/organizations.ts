import { createClient } from "./client";
import type { OrganizationRole, DeckOrgShareVisibility } from "@/types/organization";

/** True when org tables are not in Supabase (migration not run). Avoids hard failures on local/dev DBs. */
export function isOrganizationSchemaMissingError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null | undefined;
  const msg = (e?.message ?? "").toLowerCase();
  const code = String(e?.code ?? "");
  if (code === "PGRST205") return true;
  if (msg.includes("schema cache") && msg.includes("organization")) return true;
  if (msg.includes("does not exist") && msg.includes("organization")) return true;
  return false;
}

export type OrganizationMembership = {
  organizationId: string;
  role: OrganizationRole;
  name: string;
  slug: string | null;
};

type MemberRow = {
  organization_id: string;
  role: OrganizationRole;
  organizations:
    | { id: string; name: string; slug: string | null }
    | { id: string; name: string; slug: string | null }[]
    | null;
};

export async function fetchMyOrganizationMemberships(): Promise<OrganizationMembership[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id);

  if (error) {
    if (isOrganizationSchemaMissingError(error)) {
      console.warn("[PSTUDY] Organization schema not found; run supabase/organization-schema.sql", error);
      return [];
    }
    throw error;
  }
  const rows = (data ?? []) as MemberRow[];
  return rows
    .map((r) => {
      const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return org
        ? {
            organizationId: r.organization_id,
            role: r.role,
            name: org.name,
            slug: org.slug ?? null,
          }
        : null;
    })
    .filter((x): x is OrganizationMembership => x !== null);
}

export type SchoolDeckListRow = {
  shareId: string;
  deckId: string;
  organizationId: string;
  organizationName: string;
  visibility: DeckOrgShareVisibility;
  deckTitle: string;
  deckOwnerId: string;
  verifiedAt: string | null;
};

/** Decks visible via org shares (RLS filters by role / verification). */
export async function fetchSchoolSharedDecks(): Promise<SchoolDeckListRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: shares, error: sErr } = await supabase.from("deck_organization_shares").select(
    `
      id,
      deck_id,
      organization_id,
      visibility,
      decks!inner (
        id,
        title,
        owner_id
      ),
      organizations (
        name
      )
    `
  );

  if (sErr) throw sErr;

  type ShareRow = {
    id: string;
    deck_id: string;
    organization_id: string;
    visibility: DeckOrgShareVisibility;
    decks:
      | { id: string; title: string; owner_id: string }
      | { id: string; title: string; owner_id: string }[]
      | null;
    organizations: { name: string } | { name: string }[] | null;
  };

  const shareList = (shares ?? []) as ShareRow[];
  if (shareList.length === 0) return [];

  const { data: verifs, error: vErr } = await supabase
    .from("deck_organization_verifications")
    .select("deck_id, organization_id, verified_at");

  if (vErr) {
    if (isOrganizationSchemaMissingError(vErr)) {
      return [];
    }
    throw vErr;
  }

  const verifMap = new Map<string, string>();
  for (const v of verifs ?? []) {
    const row = v as { deck_id: string; organization_id: string; verified_at: string };
    verifMap.set(`${row.deck_id}:${row.organization_id}`, row.verified_at);
  }

  const out: SchoolDeckListRow[] = [];
  for (const s of shareList) {
    const deck = Array.isArray(s.decks) ? s.decks[0] : s.decks;
    const org = Array.isArray(s.organizations) ? s.organizations[0] : s.organizations;
    if (!deck || !org) continue;
    const vk = `${s.deck_id}:${s.organization_id}`;
    out.push({
      shareId: s.id,
      deckId: deck.id,
      organizationId: s.organization_id,
      organizationName: org.name,
      visibility: s.visibility,
      deckTitle: deck.title,
      deckOwnerId: deck.owner_id,
      verifiedAt: verifMap.get(vk) ?? null,
    });
  }

  return out;
}

export type DeckOrgShareState = {
  shareId: string;
  organizationId: string;
  visibility: DeckOrgShareVisibility;
  verifiedAt: string | null;
};

/** All org shares for this deck within the given organizations (usually the user’s memberships). */
export async function listDeckOrgSharesForOrgs(
  deckId: string,
  organizationIds: string[]
): Promise<DeckOrgShareState[]> {
  if (organizationIds.length === 0) return [];
  const supabase = createClient();
  const { data: shares, error } = await supabase
    .from("deck_organization_shares")
    .select("id, organization_id, visibility")
    .eq("deck_id", deckId)
    .in("organization_id", organizationIds);

  if (error) {
    if (isOrganizationSchemaMissingError(error)) {
      console.warn("[PSTUDY] Organization schema not found; run supabase/organization-schema.sql", error);
      return [];
    }
    throw error;
  }
  const list = shares ?? [];
  if (list.length === 0) return [];

  const { data: verifs, error: verifErr } = await supabase
    .from("deck_organization_verifications")
    .select("deck_id, organization_id, verified_at")
    .eq("deck_id", deckId)
    .in(
      "organization_id",
      list.map((s) => (s as { organization_id: string }).organization_id)
    );

  if (verifErr && !isOrganizationSchemaMissingError(verifErr)) {
    throw verifErr;
  }

  const verifMap = new Map<string, string>();
  for (const v of verifs ?? []) {
    const row = v as { organization_id: string; verified_at: string };
    verifMap.set(row.organization_id, row.verified_at);
  }

  return list.map((s) => {
    const row = s as { id: string; organization_id: string; visibility: DeckOrgShareVisibility };
    return {
      shareId: row.id,
      organizationId: row.organization_id,
      visibility: row.visibility,
      verifiedAt: verifMap.get(row.organization_id) ?? null,
    };
  });
}

export async function getDeckOrgShareForOrg(
  deckId: string,
  organizationId: string
): Promise<DeckOrgShareState | null> {
  const rows = await listDeckOrgSharesForOrgs(deckId, [organizationId]);
  return rows[0] ?? null;
}

export async function upsertSchoolDeckShare(
  deckId: string,
  organizationId: string,
  visibility: DeckOrgShareVisibility
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase.from("deck_organization_shares").upsert(
    {
      deck_id: deckId,
      organization_id: organizationId,
      visibility,
      shared_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "deck_id,organization_id" }
  );

  if (error) throw error;
}

export async function removeSchoolDeckShare(deckId: string, organizationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("deck_organization_shares")
    .delete()
    .eq("deck_id", deckId)
    .eq("organization_id", organizationId);

  if (error) throw error;
}

export async function verifySchoolDeckShare(
  deckId: string,
  organizationId: string
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase.from("deck_organization_verifications").insert({
    deck_id: deckId,
    organization_id: organizationId,
    verified_by: user.id,
  });

  if (error) throw error;
}
