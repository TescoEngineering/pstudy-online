"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { useToast } from "@/components/Toast";
import type { OrganizationRole } from "@/types/organization";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

type AdminOrg = { id: string; name: string; slug: string | null };
type Member = { userId: string; email: string | null; role: OrganizationRole; joinedAt: string };

export default function SchoolAdminPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("student");
  const [busy, setBusy] = useState(false);

  const loadMembers = useCallback(async (oid: string) => {
    if (!oid) return;
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/org/members?organizationId=${encodeURIComponent(oid)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "load failed");
      setMembers((data.members ?? []) as Member[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/org/admin-orgs", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "load failed");
        const list = (data.organizations ?? []) as AdminOrg[];
        if (cancelled) return;
        setOrgs(list);
        if (list.length > 0) {
          setOrgId((prev) => prev || list[0]!.id);
        }
      } catch {
        if (!cancelled) toast.error(t("orgAdmin.loadOrgsFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, toast, t]);

  useEffect(() => {
    if (orgId) void loadMembers(orgId);
  }, [orgId, loadMembers]);

  async function handleAddExisting() {
    if (!orgId || !email.trim()) {
      toast.error(t("orgAdmin.emailRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/org/members", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, email: email.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      toast.success(t("orgAdmin.memberAdded"));
      setEmail("");
      await loadMembers(orgId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orgAdmin.addFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendInvite() {
    if (!orgId || !email.trim()) {
      toast.error(t("orgAdmin.emailRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/org/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, email: email.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      if (data.emailed) {
        toast.success(t("orgAdmin.inviteSent"));
      } else {
        toast.toast(t("orgAdmin.inviteCreatedNoEmail"));
      }
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orgAdmin.inviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!orgId || !window.confirm(t("orgAdmin.removeConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/org/members", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      toast.success(t("orgAdmin.memberRemoved"));
      await loadMembers(orgId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orgAdmin.removeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(userId: string, role: OrganizationRole) {
    if (!orgId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/org/members/role", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, userId, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "failed");
      toast.success(t("orgAdmin.roleUpdated"));
      await loadMembers(orgId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orgAdmin.roleUpdateFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-stone-600">{t("common.loading")}</p>
        <HelpNavLink />
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-12">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-stone-700">{t("orgAdmin.notAdmin")}</p>
          <Link href="/school" className="mt-4 inline-block text-pstudy-primary hover:underline">
            {t("school.title")}
          </Link>
          <div className="mt-4">
            <HelpNavLink />
          </div>
        </div>
      </div>
    );
  }

  const currentOrg = orgs.find((o) => o.id === orgId);

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/dashboard">{t("dashboard.myDecks")}</AppHeaderLink>
            <AppHeaderLink href="/school">{t("school.title")}</AppHeaderLink>
            <HelpNavLink />
          </>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-stone-900">{t("orgAdmin.pageTitle")}</h1>
        <p className="mb-6 text-sm text-stone-600">{t("orgAdmin.intro")}</p>

        {orgs.length > 1 ? (
          <div className="mb-6">
            <label htmlFor="org-select" className="mb-1 block text-sm font-medium text-stone-700">
              {t("orgAdmin.schoolSelect")}
            </label>
            <select
              id="org-select"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full max-w-md rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <section className="mb-8 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-900">{t("orgAdmin.addPeople")}</h2>
          <p className="mb-4 text-sm text-stone-600">{t("orgAdmin.addPeopleHint")}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex-1 min-w-[12rem]">
              <label className="mb-1 block text-xs font-medium text-stone-600" htmlFor="invite-email">
                {t("orgAdmin.email")}
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                placeholder={t("orgAdmin.emailPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600" htmlFor="invite-role">
                {t("orgAdmin.role")}
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                <option value="student">{t("orgAdmin.roleStudent")}</option>
                <option value="teacher">{t("orgAdmin.roleTeacher")}</option>
                <option value="admin">{t("orgAdmin.roleAdmin")}</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAddExisting()}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {t("orgAdmin.addExisting")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSendInvite()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {t("orgAdmin.sendInvite")}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            {t("orgAdmin.membersTitle")}
            {currentOrg ? ` — ${currentOrg.name}` : ""}
          </h2>
          {membersLoading ? (
            <p className="text-sm text-stone-500">{t("common.loading")}</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-stone-500">{t("orgAdmin.noMembers")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600">
                    <th className="py-2 pr-4 font-medium">{t("orgAdmin.email")}</th>
                    <th className="py-2 pr-4 font-medium">{t("orgAdmin.role")}</th>
                    <th className="py-2 font-medium">{t("orgAdmin.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId} className="border-b border-stone-100">
                      <td className="py-2 pr-4 text-stone-900">
                        {m.email ?? t("orgAdmin.emailUnknown")}
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={m.role}
                          disabled={busy}
                          onChange={(e) =>
                            void handleRoleChange(m.userId, e.target.value as OrganizationRole)
                          }
                          className="rounded border border-stone-300 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          <option value="student">{t("orgAdmin.roleStudent")}</option>
                          <option value="teacher">{t("orgAdmin.roleTeacher")}</option>
                          <option value="admin">{t("orgAdmin.roleAdmin")}</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRemoveMember(m.userId)}
                          className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          {t("orgAdmin.remove")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
