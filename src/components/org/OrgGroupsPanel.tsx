"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrganizationRole } from "@/types/organization";
import type { OrgMemberRow } from "@/lib/org-admin";
import { useToast } from "@/components/Toast";

type GroupListRow = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
};

type ToastFn = ReturnType<typeof useToast>;

type OrgGroupsPanelProps = {
  organizationId: string;
  members: OrgMemberRow[];
  t: (key: string, vars?: Record<string, string | number>) => string;
  toast: ToastFn;
};

function roleLabel(role: OrganizationRole, t: OrgGroupsPanelProps["t"]) {
  if (role === "student") return t("orgAdmin.roleStudent");
  if (role === "teacher") return t("orgAdmin.roleTeacher");
  return t("orgAdmin.roleAdmin");
}

export function OrgGroupsPanel({ organizationId, members, t, toast }: OrgGroupsPanelProps) {
  const [groups, setGroups] = useState<GroupListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberRows, setMemberRows] = useState<OrgMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [preview, setPreview] = useState<{
    inOrg: { userId: string; email: string }[];
    notInCommunity: string[];
    invalidLineCount: number;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupListRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const loadGroups = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/org/groups?organizationId=${encodeURIComponent(organizationId)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "load failed");
      setGroups((data.groups ?? []) as GroupListRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast, t]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const loadGroupMembers = useCallback(
    async (groupId: string) => {
      setMembersLoading(true);
      try {
        const res = await fetch(
          `/api/org/groups/${encodeURIComponent(groupId)}/members?organizationId=${encodeURIComponent(organizationId)}`,
          { credentials: "include" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "load failed");
        setMemberRows((data.members ?? []) as OrgMemberRow[]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
        setMemberRows([]);
      } finally {
        setMembersLoading(false);
      }
    },
    [organizationId, toast, t]
  );

  useEffect(() => {
    if (expandedId) void loadGroupMembers(expandedId);
    else {
      setMemberRows([]);
      setSelected(new Set());
    }
  }, [expandedId, loadGroupMembers]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const em = (m.email ?? "").toLowerCase();
      return em.includes(q) || m.userId.toLowerCase().includes(q);
    });
  }, [members, search]);

  const memberIdsInGroup = useMemo(() => new Set(memberRows.map((m) => m.userId)), [memberRows]);

  async function handleCreateOrSave() {
    const name = formName.trim();
    if (!name) {
      toast.error(t("orgGroups.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      if (editGroup) {
        const res = await fetch(`/api/org/groups/${encodeURIComponent(editGroup.id)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            name,
            description: formDescription.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
        toast.success(t("orgGroups.groupUpdated"));
        setEditGroup(null);
        setCreateOpen(false);
      } else {
        const res = await fetch("/api/org/groups", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId,
            name,
            description: formDescription.trim() || null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
        toast.success(t("orgGroups.groupCreated"));
        setCreateOpen(false);
      }
      setFormName("");
      setFormDescription("");
      await loadGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(group: GroupListRow) {
    if (!window.confirm(t("orgGroups.deleteConfirm", { name: group.name }))) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/org/groups/${encodeURIComponent(group.id)}?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      toast.success(t("orgGroups.groupDeleted"));
      if (expandedId === group.id) setExpandedId(null);
      await loadGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditGroup(null);
    setFormName("");
    setFormDescription("");
    setCreateOpen(true);
  }

  function openEdit(g: GroupListRow) {
    setEditGroup(g);
    setFormName(g.name);
    setFormDescription(g.description ?? "");
    setCreateOpen(true);
  }

  async function addSelectedToGroup() {
    if (!expandedId) return;
    const userIds = [...selected].filter((id) => !memberIdsInGroup.has(id));
    if (userIds.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/groups/${encodeURIComponent(expandedId)}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, userIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      const n = typeof data.added === "number" ? data.added : userIds.length;
      toast.success(t("orgGroups.addedNToGroup", { count: n }));
      setSelected(new Set());
      await loadGroupMembers(expandedId);
      await loadGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelectedFromGroup() {
    if (!expandedId) return;
    const userIds = [...selected].filter((id) => memberIdsInGroup.has(id));
    if (userIds.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/groups/${encodeURIComponent(expandedId)}/members`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, userIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      toast.success(t("orgGroups.removedFromGroup"));
      setSelected(new Set());
      await loadGroupMembers(expandedId);
      await loadGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function runBulkPreview() {
    if (!expandedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/groups/${encodeURIComponent(expandedId)}/members/bulk-preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, paste: pasteText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      setPreview({
        inOrg: data.inOrg ?? [],
        notInCommunity: data.notInCommunity ?? [],
        invalidLineCount: data.invalidLineCount ?? 0,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function runBulkCommit(confirmInvites: boolean) {
    if (!expandedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/org/groups/${encodeURIComponent(expandedId)}/members/bulk-commit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          paste: pasteText,
          confirmInvites,
          inviteRole: "student" satisfies OrganizationRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      const added = data.addedToGroup ?? 0;
      if (added > 0) toast.success(t("orgGroups.addedNToGroup", { count: added }));
      if (data.invalidLineCount > 0) {
        toast.toast(t("orgGroups.skippedInvalidEmails", { count: data.invalidLineCount }));
      }
      if (confirmInvites && (data.invitesCreated > 0 || data.invitesReused > 0)) {
        toast.success(
          t("orgGroups.invitesAndQueueDone", {
            created: data.invitesCreated ?? 0,
            reused: data.invitesReused ?? 0,
          })
        );
      }
      setPasteOpen(false);
      setPasteText("");
      setPreview(null);
      await loadGroupMembers(expandedId);
      await loadGroups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  function togglePick(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (loading) {
    return <p className="text-sm text-stone-500">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">{t("orgGroups.groupsTitle")}</h2>
        <button type="button" disabled={busy} onClick={openCreate} className="btn-primary text-sm disabled:opacity-50">
          {t("orgGroups.createGroup")}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-stone-600">{t("orgGroups.noGroupsYet")}</p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id} className="rounded-lg border border-stone-200 bg-stone-50/80">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <button
                  type="button"
                  className="text-left font-medium text-stone-900 hover:underline"
                  onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                >
                  {g.name}{" "}
                  <span className="text-sm font-normal text-stone-500">
                    ({t("orgGroups.memberCount", { count: g.memberCount })})
                  </span>
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-sm text-pstudy-primary hover:underline"
                    onClick={() => openEdit(g)}
                  >
                    {t("orgGroups.edit")}
                  </button>
                  <button
                    type="button"
                    className="text-sm text-red-700 hover:underline"
                    onClick={() => void handleDelete(g)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
              {g.description ? <p className="px-3 pb-2 text-sm text-stone-600">{g.description}</p> : null}
              {expandedId === g.id ? (
                <div className="border-t border-stone-200 bg-white px-3 py-3 text-sm">
                  <p className="mb-2 font-medium text-stone-800">{t("orgGroups.groupMembers")}</p>
                  {membersLoading ? (
                    <p className="text-stone-500">{t("common.loading")}</p>
                  ) : (
                    <>
                      <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto">
                        {memberRows.map((m) => (
                          <li key={m.userId} className="text-stone-700">
                            {m.email ?? m.userId} <span className="text-stone-400">({roleLabel(m.role, t)})</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mb-2 flex flex-wrap gap-2">
                        <input
                          type="search"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={t("orgGroups.searchMembers")}
                          className="min-w-[12rem] flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={busy}
                          onClick={() => setPasteOpen((o) => !o)}
                        >
                          {t("orgGroups.bulkPasteEmails")}
                        </button>
                      </div>
                      {pasteOpen ? (
                        <div className="mb-3 rounded border border-stone-200 bg-stone-50 p-2">
                          <textarea
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            rows={4}
                            className="w-full rounded border border-stone-300 p-2 text-xs font-mono"
                            placeholder={t("orgGroups.pastePlaceholder")}
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-secondary text-xs"
                              disabled={busy}
                              onClick={() => void runBulkPreview()}
                            >
                              {t("orgGroups.previewPaste")}
                            </button>
                          </div>
                          {preview ? (
                            <div className="mt-3 space-y-2 text-xs">
                              {preview.inOrg.length > 0 ? (
                                <p className="text-emerald-800">
                                  {t("orgGroups.willAddExisting", { count: preview.inOrg.length })}
                                </p>
                              ) : null}
                              {preview.invalidLineCount > 0 ? (
                                <p className="text-amber-800">
                                  {t("orgGroups.skippedInvalidEmails", { count: preview.invalidLineCount })}
                                </p>
                              ) : null}
                              {preview.notInCommunity.length > 0 ? (
                                <div className="rounded border border-amber-200 bg-amber-50 p-2">
                                  <p className="font-medium text-amber-950">
                                    {t("orgGroups.notMembersIntro", { count: preview.notInCommunity.length })}
                                  </p>
                                  <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto text-amber-900">
                                    {preview.notInCommunity.map((em) => (
                                      <li key={em}>{em}</li>
                                    ))}
                                  </ul>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className="btn-primary text-xs"
                                      disabled={busy}
                                      onClick={() => void runBulkCommit(true)}
                                    >
                                      {t("orgGroups.sendInvitesAndQueue")}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-secondary text-xs"
                                      disabled={busy}
                                      onClick={() => void runBulkCommit(false)}
                                    >
                                      {t("orgGroups.skipThese")}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-primary mt-2 text-xs"
                                  disabled={busy || preview.inOrg.length === 0}
                                  onClick={() => void runBulkCommit(false)}
                                >
                                  {t("orgGroups.applyInOrgOnly")}
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="mb-1 text-xs font-medium text-stone-600">{t("orgGroups.addFromDirectory")}</p>
                      <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-stone-100 p-1">
                        {filteredMembers.map((m) => (
                          <label key={m.userId} className="flex cursor-pointer items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={selected.has(m.userId)}
                              onChange={() => togglePick(m.userId)}
                            />
                            <span>{m.email ?? m.userId}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary text-xs disabled:opacity-50"
                          disabled={busy || [...selected].every((id) => memberIdsInGroup.has(id))}
                          onClick={() => void addSelectedToGroup()}
                        >
                          {t("orgGroups.addToGroup")}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs disabled:opacity-50"
                          disabled={busy || [...selected].every((id) => !memberIdsInGroup.has(id))}
                          onClick={() => void removeSelectedFromGroup()}
                        >
                          {t("orgGroups.removeFromGroup")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-stone-900">
              {editGroup ? t("orgGroups.editGroup") : t("orgGroups.createGroup")}
            </h3>
            <label className="mt-3 block text-xs font-medium text-stone-600">{t("orgGroups.groupName")}</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <label className="mt-3 block text-xs font-medium text-stone-600">{t("orgGroups.groupDescription")}</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setCreateOpen(false);
                  setEditGroup(null);
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy}
                onClick={() => void handleCreateOrSave()}
              >
                {t("orgGroups.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
