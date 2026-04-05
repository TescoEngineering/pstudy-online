"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { useToast } from "@/components/Toast";

type Preview = { organizationName: string; role: string; emailHint: string };

export default function OrgInvitePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const token = Array.isArray(params.token) ? params.token[0] : params.token ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/org/invites/preview?token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(typeof data.error === "string" ? data.error : t("orgAdmin.inviteInvalid"));
        setPreview(null);
        return;
      }
      setPreview(data as Preview);
    } catch {
      setLoadError(t("orgAdmin.inviteInvalid"));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    })();
  }, []);

  async function handleAccept() {
    setAccepting(true);
    try {
      const res = await fetch("/api/org/invites/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push(
            `/login?next=${encodeURIComponent(`/invite/org/${token}`)}`
          );
          return;
        }
        throw new Error(typeof data.error === "string" ? data.error : "accept failed");
      }
      toast.success(
        data.alreadyMember ? t("orgAdmin.acceptAlreadyMember") : t("orgAdmin.acceptSuccess")
      );
      router.push("/school");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orgAdmin.acceptFailed"));
    } finally {
      setAccepting(false);
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

  if (loadError || !preview) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-12 text-center">
        <p className="text-stone-700">{loadError ?? t("orgAdmin.inviteInvalid")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/login" className="text-pstudy-primary hover:underline">
            {t("login.logIn")}
          </Link>
          <Link href="/school" className="text-pstudy-primary hover:underline">
            {t("school.title")}
          </Link>
          <HelpNavLink />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <Logo size="sm" withText />
          <HelpNavLink />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="text-xl font-bold text-stone-900">{t("orgAdmin.inviteTitle")}</h1>
        <p className="mt-3 text-stone-700">
          {t("orgAdmin.inviteBody", {
            school: preview.organizationName,
            role: preview.role,
            email: preview.emailHint,
          })}
        </p>
        {!userEmail ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-stone-600">{t("orgAdmin.inviteSignInFirst")}</p>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/org/${token}`)}`}
              className="btn-primary inline-block text-sm"
            >
              {t("orgAdmin.inviteGoLogin")}
            </Link>
            <p className="text-sm text-stone-600">{t("orgAdmin.inviteNoAccount")}</p>
            <Link href="/login" className="btn-secondary inline-block text-sm">
              {t("orgAdmin.inviteCreateAccount")}
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-stone-600">
              {t("orgAdmin.inviteSignedInAs", { email: userEmail })}
            </p>
            <button
              type="button"
              disabled={accepting}
              onClick={() => void handleAccept()}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {accepting ? t("common.loading") : t("orgAdmin.inviteAccept")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
