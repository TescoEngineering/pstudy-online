"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Deck } from "@/types/pstudy";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import {
  fetchDecks,
  createDeck,
  deleteDeck as deleteDeckDb,
  mergeDecksIntoNew,
  duplicateOwnedDeck,
} from "@/lib/supabase/decks";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTitle, setMergeTitle] = useState("");
  const [mergeBusy, setMergeBusy] = useState(false);
  const [duplicatingDeckId, setDuplicatingDeckId] = useState<string | null>(null);
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

  const defaultMergeTitle = useMemo(() => {
    const titles = selectedDeckIds
      .map((id) => decks.find((d) => d.id === id)?.title)
      .filter((x): x is string => Boolean(x && x.trim()));
    if (titles.length === 0) return "";
    const joined = titles.join(" + ");
    return joined.length > 140 ? `${joined.slice(0, 137)}…` : joined;
  }, [selectedDeckIds, decks]);

  function toggleDeckSelected(id: string) {
    setSelectedDeckIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function openMergeModal() {
    if (selectedDeckIds.length < 2) {
      toast.error(t("dashboard.mergeDecksNeedTwo"));
      return;
    }
    setMergeTitle(defaultMergeTitle || t("dashboard.mergeDecksDefaultTitle"));
    setMergeOpen(true);
  }

  async function confirmMerge() {
    if (selectedDeckIds.length < 2) return;
    setMergeBusy(true);
    try {
      const merged = await mergeDecksIntoNew(selectedDeckIds, mergeTitle);
      setDecks((prev) => [merged, ...prev.filter((d) => d.id !== merged.id)]);
      setSelectedDeckIds([]);
      setMergeOpen(false);
      setMergeMode(false);
      toast.success(t("dashboard.mergeDecksSuccess"));
      router.push(`/deck/${merged.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.mergeDecksFailed"));
    } finally {
      setMergeBusy(false);
    }
  }

  async function handleCreateDeck() {
    try {
      const newDeck = await createDeck(t("dashboard.untitledDeck"));
      setDecks((prev) => [newDeck, ...prev]);
      toast.success(t("dashboard.deckCreated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failedToCreateDeck"));
    }
  }

  async function handleDuplicateForEdit(deckId: string, publicNextRevision?: boolean) {
    if (duplicatingDeckId) return;
    setDuplicatingDeckId(deckId);
    try {
      const copy = await duplicateOwnedDeck(deckId, {
        publicNextRevision: publicNextRevision ?? false,
      });
      setDecks((prev) => [copy, ...prev.filter((d) => d.id !== copy.id)]);
      toast.success(t("dashboard.duplicateDeckSuccess"));
      router.push(`/deck/${copy.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setDuplicatingDeckId(null);
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
      setSelectedDeckIds((prev) => prev.filter((id) => id !== deleteTarget));
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
        <p className="text-stone-600">{t("common.loading")}</p>
        <HelpNavLink />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-4">
          <div className="shrink-0">
            <Logo size="sm" withText />
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:justify-end">
            <Link href="/account" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.navAccount")}
            </Link>
            <Link
              href="/school"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("dashboard.school")}
            </Link>
            <Link
              href="/community"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("dashboard.community")}
            </Link>
            <Link
              href="/my-exams"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("exam.myAssignedExams")}
            </Link>
            <Link
              href="/import"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("dashboard.importTxt")}
            </Link>
            <Link
              href="/exams"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              {t("exam.title")}
            </Link>
            <Link href="/help" className="text-stone-600 hover:text-pstudy-primary">
              {t("help.nav")}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-stone-500 hover:text-stone-700"
            >
              {t("dashboard.signOut")}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-stone-900">{t("dashboard.myDecks")}</h1>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className={`btn-secondary disabled:opacity-50${mergeMode ? " ring-2 ring-pstudy-primary ring-offset-2" : ""}`}
              disabled={!mergeMode && decks.length < 2}
              title={!mergeMode && decks.length < 2 ? t("dashboard.mergeDecksNeedTwo") : undefined}
              onClick={() => {
                if (mergeMode) {
                  setMergeMode(false);
                  setSelectedDeckIds([]);
                  setMergeOpen(false);
                } else {
                  setMergeMode(true);
                }
              }}
            >
              {t("dashboard.mergeDecks")}
            </button>
            <button type="button" onClick={handleCreateDeck} className="btn-primary">
              {t("dashboard.newDeck")}
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-red-600">{error}</p>
        )}

        {mergeMode ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <ContextHint>
                <p className="m-0 text-sm">{t("dashboard.mergeDecksHint")}</p>
              </ContextHint>
            </div>
            {selectedDeckIds.length > 0 ? (
              <div
                className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm"
                role="status"
              >
                <span className="text-sm font-medium text-stone-800">
                  {t("dashboard.mergeDecksSelected", { count: selectedDeckIds.length })}
                </span>
                <button
                  type="button"
                  className="btn-primary text-sm disabled:opacity-50"
                  disabled={selectedDeckIds.length < 2}
                  onClick={openMergeModal}
                >
                  {t("dashboard.mergeDecksContinue")}
                </button>
                <button
                  type="button"
                  className="text-sm text-stone-600 underline decoration-stone-400 hover:text-stone-900"
                  onClick={() => setSelectedDeckIds([])}
                >
                  {t("dashboard.mergeDecksClearSelection")}
                </button>
                <button
                  type="button"
                  className="ml-auto text-sm font-medium text-stone-700 hover:text-stone-900"
                  onClick={() => {
                    setMergeMode(false);
                    setSelectedDeckIds([]);
                  }}
                >
                  {t("dashboard.mergeDecksExit")}
                </button>
              </div>
            ) : (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-stone-300 bg-stone-50/80 px-4 py-3">
                <p className="text-sm text-stone-600">{t("dashboard.mergeDecksSelectPrompt")}</p>
                <button
                  type="button"
                  className="text-sm font-medium text-stone-700 hover:text-stone-900"
                  onClick={() => {
                    setMergeMode(false);
                    setSelectedDeckIds([]);
                  }}
                >
                  {t("dashboard.mergeDecksExit")}
                </button>
              </div>
            )}
          </>
        ) : null}

        {decks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4 flex flex-wrap items-center justify-center gap-2">
              <span>{t("dashboard.noDecks")}</span>
              <ContextHint>
                <p className="m-0 text-sm">{t("dashboard.noDecksHint")}</p>
              </ContextHint>
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
                className="card flex items-center justify-between gap-3"
              >
                {mergeMode ? (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    checked={selectedDeckIds.includes(deck.id)}
                    onChange={() => toggleDeckSelected(deck.id)}
                    aria-label={t("dashboard.mergeDecksCheckboxAria", { title: deck.title })}
                  />
                ) : (
                  <span className="w-4 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
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
                    {deck.isPublic ? (
                      deck.publicationStatus === "checked" ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          {t("deckReview.badgeChecked")}
                        </span>
                      ) : deck.publicationStatus === "superseded" ? (
                        <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
                          {t("deckReview.badgeSuperseded")}
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          {t("deckReview.badgeDraft")}
                        </span>
                      )
                    ) : null}
                    {deck.isPublic &&
                    deck.publicationStatus === "draft" &&
                    deck.reviewStatus &&
                    deck.reviewStatus !== "none" ? (
                      <span
                        className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900"
                        title={t("deckReview.reviewStatusHint")}
                      >
                        {t(`deckReview.reviewStatus_${deck.reviewStatus}`)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Link
                    href={`/practice/${deck.id}`}
                    className="btn-secondary text-sm"
                  >
                    {t("common.practice")}
                  </Link>
                  {!mergeMode && deck.publicationStatus === "checked" ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleDuplicateForEdit(
                          deck.id,
                          deck.publicationStatus === "checked" && !!deck.isPublic
                        )
                      }
                      disabled={duplicatingDeckId !== null}
                      className="btn-secondary text-sm disabled:opacity-60"
                    >
                      {duplicatingDeckId === deck.id ? t("community.copying") : t("deck.duplicateToEdit")}
                    </button>
                  ) : null}
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

      {mergeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !mergeBusy && setMergeOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-stone-900">
              {t("dashboard.mergeDecksModalTitle")}
              <ContextHint>
                <div className="space-y-2">
                  <p className="m-0 text-sm">{t("dashboard.mergeDecksOrderHint")}</p>
                  <p className="m-0 text-sm">{t("dashboard.mergeDecksKeepOriginals")}</p>
                </div>
              </ContextHint>
            </h3>
            <label htmlFor="merge-deck-title" className="mt-4 block text-sm font-medium text-stone-700">
              {t("dashboard.mergeDecksTitleLabel")}
            </label>
            <input
              id="merge-deck-title"
              type="text"
              value={mergeTitle}
              onChange={(e) => setMergeTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              autoComplete="off"
              disabled={mergeBusy}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={mergeBusy}
                onClick={() => setMergeOpen(false)}
              >
                {t("dashboard.mergeDecksCancel")}
              </button>
              <button type="button" className="btn-primary disabled:opacity-60" disabled={mergeBusy} onClick={confirmMerge}>
                {mergeBusy ? t("common.loading") : t("dashboard.mergeDecksConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
