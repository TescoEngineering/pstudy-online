"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrganizationMembership } from "@/lib/supabase/organizations";

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};

type MemberRow = { userId: string; email: string | null; role: string };

export function OrgSchoolGroupsReadonly({
  memberships,
  t,
}: {
  memberships: OrganizationMembership[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const orgsToShow = useMemo(
    () => memberships.filter((m) => m.role === "teacher" || m.role === "admin"),
    [memberships]
  );
  const orgIdsCsv = useMemo(
    () => orgsToShow.map((m) => m.organizationId).sort().join(","),
    [orgsToShow]
  );

  const [byOrg, setByOrg] = useState<Record<string, GroupRow[]>>({});
  const [loadedOrg, setLoadedOrg] = useState<Set<string>>(() => new Set());
  const [membersByGroup, setMembersByGroup] = useState<Record<string, MemberRow[]>>({});
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const loadOrg = useCallback(async (organizationId: string) => {
    try {
      const res = await fetch(`/api/org/groups?organizationId=${encodeURIComponent(organizationId)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "load failed");
      setByOrg((prev) => ({ ...prev, [organizationId]: (data.groups ?? []) as GroupRow[] }));
    } catch {
      setByOrg((prev) => ({ ...prev, [organizationId]: [] }));
    } finally {
      setLoadedOrg((prev) => new Set(prev).add(organizationId));
    }
  }, []);

  useEffect(() => {
    const ids = orgIdsCsv ? orgIdsCsv.split(",") : [];
    for (const oid of ids) {
      if (!loadedOrg.has(oid)) void loadOrg(oid);
    }
  }, [orgIdsCsv, loadedOrg, loadOrg]);

  async function loadMembers(organizationId: string, groupId: string) {
    try {
      const res = await fetch(
        `/api/org/groups/${encodeURIComponent(groupId)}/members?organizationId=${encodeURIComponent(organizationId)}`,
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const raw = (data.members ?? []) as { userId: string; email: string | null; role: string }[];
      setMembersByGroup((prev) => ({ ...prev, [groupId]: raw }));
    } catch {
      /* ignore */
    }
  }

  if (orgsToShow.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-stone-900">{t("school.groupsSectionTitle")}</h2>
      <p className="mb-4 text-sm text-stone-600">{t("school.groupsSectionHint")}</p>
      <div className="space-y-6">
        {orgsToShow.map((m) => {
          const groups = byOrg[m.organizationId] ?? [];
          const loading = !loadedOrg.has(m.organizationId);
          return (
            <div key={m.organizationId}>
              <h3 className="text-sm font-semibold text-stone-800">{m.name}</h3>
              {loading ? (
                <p className="text-sm text-stone-500">{t("common.loading")}</p>
              ) : groups.length === 0 ? (
                <p className="text-sm text-stone-500">{t("orgGroups.noGroupsYet")}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {groups.map((g) => (
                    <li key={g.id} className="rounded-lg border border-stone-100 bg-stone-50/80">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-stone-900"
                        onClick={() => {
                          const next = openGroup === g.id ? null : g.id;
                          setOpenGroup(next);
                          if (next === g.id && !membersByGroup[g.id]) void loadMembers(m.organizationId, g.id);
                        }}
                      >
                        <span>
                          {g.name}{" "}
                          <span className="font-normal text-stone-500">
                            ({t("orgGroups.memberCount", { count: g.memberCount ?? 0 })})
                          </span>
                        </span>
                        <span className="text-stone-400">{openGroup === g.id ? "▾" : "▸"}</span>
                      </button>
                      {g.description ? (
                        <p className="border-t border-stone-100 px-3 py-1 text-xs text-stone-600">{g.description}</p>
                      ) : null}
                      {openGroup === g.id ? (
                        <div className="border-t border-stone-100 bg-white px-3 py-2 text-xs">
                          <p className="mb-1 font-medium text-stone-700">{t("orgGroups.groupMembers")}</p>
                          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                            {(membersByGroup[g.id] ?? []).map((mem) => (
                              <li key={mem.userId} className="text-stone-700">
                                {mem.email ?? mem.userId}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
