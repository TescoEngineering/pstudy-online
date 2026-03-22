"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Deck } from "@/types/pstudy";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import {
  fetchDecks,
  createDeck,
  deleteDeck as deleteDeckDb,
} from "@/lib/supabase/decks";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Logo } from "@/components/Logo";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        const data = await fetchDecks();
        setDecks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.failedToLoadDecks"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleCreateDeck() {
    try {
      const newDeck = await createDeck(t("dashboard.untitledDeck"));
      setDecks((prev) => [newDeck, ...prev]);
      toast.success(t("dashboard.deckCreated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failedToCreateDeck"));
    }
  }

  async function handleDeleteDeck(id: string) {
    setDeleteTarget(id);
  }

  async function confirmDeleteDeck() {
    if (!deleteTarget) return;
    try {
      await deleteDeckDb(deleteTarget);
      setDecks((prev) => prev.filter((d) => d.id !== deleteTarget));
      toast.success(t("dashboard.deckDeleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failedToDeleteDeck"));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-600">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Logo size="sm" withText />
          <nav className="flex items-center gap-4">
            <Link
              href="/community"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("dashboard.community")}
            </Link>
            <Link
              href="/import"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("dashboard.importTxt")}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              {t("dashboard.signOut")}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-stone-900">{t("dashboard.myDecks")}</h1>
          <button onClick={handleCreateDeck} className="btn-primary">
            {t("dashboard.newDeck")}
          </button>
        </div>

        {error && (
          <p className="mb-4 text-red-600">{error}</p>
        )}

        {decks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">{t("dashboard.noDecks")}</p>
            <p className="mb-4">
              {t("dashboard.noDecksHint")}
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={handleCreateDeck} className="btn-primary">
                {t("dashboard.newDeck")}
              </button>
              <Link href="/import" className="btn-secondary">
                {t("dashboard.importTxt")}
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="card flex items-center justify-between"
              >
                <div>
                  <Link
                    href={`/deck/${deck.id}`}
                    className="font-semibold text-pstudy-primary hover:underline"
                  >
                    {deck.title}
                  </Link>
                  <p className="text-sm text-stone-500">
                    {deck.items.length} {t("dashboard.items", { count: deck.items.length })}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                        deck.isPublic
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {deck.isPublic ? t("dashboard.shared") : t("dashboard.private")}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/practice/${deck.id}`}
                    className="btn-secondary text-sm"
                  >
                    {t("common.practice")}
                  </Link>
                  <button
                    onClick={() => handleDeleteDeck(deck.id)}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteDeck}
        title={t("dashboard.deleteDeckConfirm")}
        confirmLabel={t("common.delete")}
      />
    </div>
  );
}
