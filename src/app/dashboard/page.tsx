"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  invalidateOwnedDecksListCache,
  updateDeck,
  type PublicDecksFilters,
} from "@/lib/supabase/decks";
import { filterDecksByPublicDeckFilters } from "@/lib/deck-list-filters";
import { FIELDS_OF_INTEREST, getTopicsForField, getAllTopics } from "@/lib/deck-attributes";
import { DECK_CONTENT_LANGUAGE_CODES, parseDeckContentLanguages } from "@/lib/deck-content-language";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

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
  const [renameDeckId, setRenameDeckId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const [includeNoLanguage, setIncludeNoLanguage] = useState(true);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  function toggleLanguageFilter(code: string) {
    setLanguageFilters((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  const languageSummary = useMemo(() => {
    if (languageFilters.length === 0) return t("community.allLanguages");
    const names = languageFilters.map((c) => t(`deck.contentLang_${c}`));
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return `${names[0]}, ${names[1]}`;
    return `${names[0]}, ${names[1]} ${t("community.languagesCountMore", { rest: names.length - 2 })}`;
  }, [languageFilters, t]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!langMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLangMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [langMenuOpen]);

  const publicDeckFilters: PublicDecksFilters | undefined = useMemo(() => {
    const f: PublicDecksFilters = {};
    if (debouncedSearch.trim()) f.search = debouncedSearch.trim();
    if (fieldFilter) f.fieldOfInterest = fieldFilter;
    if (topicFilter) f.topic = topicFilter;
    if (languageFilters.length > 0) {
      f.languages = languageFilters;
      f.includeUnspecifiedLanguage = includeNoLanguage;
    }
    const hasAny =
      !!f.search ||
      !!f.fieldOfInterest ||
      !!f.topic ||
      (f.languages && f.languages.length > 0);
    return hasAny ? f : undefined;
  }, [
    debouncedSearch,
    fieldFilter,
    topicFilter,
    languageFilters,
    includeNoLanguage,
  ]);

  const visibleDecks = useMemo(
    () => filterDecksByPublicDeckFilters(decks, publicDeckFilters),
    [decks, publicDeckFilters]
  );

  function clearDeckFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setFieldFilter("");
    setTopicFilter("");
    setLanguageFilters([]);
    setIncludeNoLanguage(true);
    setLangMenuOpen(false);
  }

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

  function startRename(deck: Deck) {
    setRenameDeckId(deck.id);
    setRenameValue(deck.title);
  }

  function cancelRename() {
    setRenameDeckId(null);
    setRenameValue("");
  }

  async function saveRename() {
    if (!renameDeckId) return;
    const title = renameValue.trim();
    if (!title) {
      toast.error(t("dashboard.renameDeckEmpty"));
      return;
    }
    setRenameSaving(true);
    try {
      await updateDeck(renameDeckId, { title });
      setDecks((prev) =>
        prev.map((d) => (d.id === renameDeckId ? { ...d, title } : d))
      );
      cancelRename();
      toast.success(t("dashboard.renameDeckSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.renameDeckFailed"));
    } finally {
      setRenameSaving(false);
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
    invalidateOwnedDecksListCache();
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
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/dashboard" active>
              {t("dashboard.myDecks")}
            </AppHeaderLink>
            <AppHeaderLink href="/import">{t("dashboard.importTxt")}</AppHeaderLink>
            <AppHeaderLink href="/my-exams">{t("exam.title")}</AppHeaderLink>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
            <AppHeaderLink href="/account">{t("dashboard.navAccount")}</AppHeaderLink>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-stone-500 hover:text-stone-700"
            >
              {t("dashboard.signOut")}
            </button>
          </>
        }
      />

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
                  cancelRename();
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

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/community" className="btn-secondary text-sm">
            {t("dashboard.community")}
          </Link>
          <Link href="/school" className="btn-secondary text-sm">
            {t("dashboard.school")}
          </Link>
        </div>

        {error && (
          <p className="mb-4 text-red-600">{error}</p>
        )}

        {decks.length > 0 ? (
          <div className="mb-6">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-stone-800">{t("dashboard.filtersHeading")}</span>
              <ContextHint>
                <p className="m-0 text-sm text-stone-600">{t("dashboard.filterDecksHint")}</p>
              </ContextHint>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-1 block text-sm text-stone-600">{t("community.searchByTitle")}</label>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("community.searchPlaceholder")}
                  className="w-64 max-w-full rounded-lg border border-stone-300 px-4 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-stone-600">{t("community.fieldOfInterest")}</label>
                <select
                  value={fieldFilter}
                  onChange={(e) => {
                    setFieldFilter(e.target.value);
                    setTopicFilter("");
                  }}
                  className="rounded-lg border border-stone-300 px-4 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                >
                  <option value="">{t("community.allFields")}</option>
                  {FIELDS_OF_INTEREST.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-stone-600">{t("community.topic")}</label>
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="rounded-lg border border-stone-300 px-4 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                >
                  <option value="">{t("community.allTopics")}</option>
                  {(fieldFilter ? getTopicsForField(fieldFilter) : getAllTopics()).map((top) => (
                    <option key={top} value={top}>
                      {top}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative" ref={langMenuRef}>
                <span className="mb-1 block text-sm text-stone-600" id="dashboard-deck-lang-label">
                  {t("deck.contentLanguage")}
                </span>
                <button
                  type="button"
                  id="dashboard-deck-lang-trigger"
                  aria-labelledby="dashboard-deck-lang-label"
                  aria-haspopup="dialog"
                  aria-expanded={langMenuOpen}
                  title={t("community.deckLanguageFilterHint")}
                  className="flex w-[min(12rem,calc(100vw-8rem))] min-w-[10rem] items-center justify-between gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-left text-sm text-stone-900 shadow-sm hover:border-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                  onClick={() => setLangMenuOpen((o) => !o)}
                >
                  <span className="min-w-0 flex-1 truncate">{languageSummary}</span>
                  <span className="shrink-0 text-stone-400" aria-hidden>
                    ▾
                  </span>
                </button>
                {langMenuOpen ? (
                  <div
                    className="absolute left-0 z-40 mt-1 max-h-[min(22rem,calc(100vh-8rem))] w-max min-w-full max-w-[18rem] overflow-hidden rounded-lg border border-stone-200 bg-white py-2 shadow-lg"
                    role="dialog"
                    aria-label={t("deck.contentLanguage")}
                  >
                    <div className="max-h-48 overflow-y-auto px-2">
                      {DECK_CONTENT_LANGUAGE_CODES.map((code) => (
                        <label
                          key={code}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                        >
                          <input
                            type="checkbox"
                            className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                            checked={languageFilters.includes(code)}
                            onChange={() => toggleLanguageFilter(code)}
                          />
                          {t(`deck.contentLang_${code}`)}
                        </label>
                      ))}
                    </div>
                    <div className="mt-1 space-y-2 border-t border-stone-100 px-3 pt-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                        <input
                          type="checkbox"
                          className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                          checked={includeNoLanguage}
                          onChange={(e) => setIncludeNoLanguage(e.target.checked)}
                          disabled={languageFilters.length === 0}
                        />
                        {t("community.includeNoLanguage")}
                      </label>
                      <button
                        type="button"
                        className="text-sm font-medium text-pstudy-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={languageFilters.length === 0}
                        onClick={() => {
                          setLanguageFilters([]);
                          setIncludeNoLanguage(true);
                        }}
                      >
                        {t("community.clearLanguages")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

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
        ) : visibleDecks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">{t("dashboard.noDecksMatchFilters")}</p>
            <button type="button" onClick={clearDeckFilters} className="btn-primary">
              {t("dashboard.clearDeckFilters")}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleDecks.map((deck) => {
              const deckLangCodes = parseDeckContentLanguages(deck.contentLanguage);
              const deckLangLabelList = deckLangCodes
                .map((c) => t(`deck.contentLang_${c}`))
                .join(t("deck.contentLanguagePairSeparator"));
              return (
                <li key={deck.id} className="card flex items-center justify-between gap-3">
                  {mergeMode ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 self-start rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                      checked={selectedDeckIds.includes(deck.id)}
                      onChange={() => toggleDeckSelected(deck.id)}
                      aria-label={t("dashboard.mergeDecksCheckboxAria", { title: deck.title })}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div>
                      {renameDeckId === deck.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void saveRename();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            className="min-w-0 max-w-md flex-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                            autoComplete="off"
                            autoFocus
                            disabled={renameSaving}
                            aria-label={t("dashboard.renameDeckInputAria")}
                          />
                          <button
                            type="button"
                            className="btn-primary text-sm"
                            disabled={renameSaving}
                            onClick={() => void saveRename()}
                          >
                            {renameSaving ? t("common.loading") : t("dashboard.renameDeckSave")}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            disabled={renameSaving}
                            onClick={cancelRename}
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <>
                          <Link
                            href={`/deck/${deck.id}`}
                            className="font-semibold text-stone-900 hover:text-pstudy-primary hover:underline"
                          >
                            {deck.title}
                          </Link>
                      {!mergeMode && deck.publicationStatus !== "checked" && deck.publicationStatus !== "verified" ? (
                            <button
                              type="button"
                              onClick={() => startRename(deck)}
                              className="ml-2 align-baseline text-sm font-medium text-pstudy-primary decoration-pstudy-primary/40 hover:underline"
                            >
                              {t("dashboard.renameDeck")}
                            </button>
                          ) : null}
                        </>
                      )}
                      {deckLangCodes.length > 0 ? (
                        <span className="inline-flex flex-wrap items-center gap-1 align-middle">
                          {deckLangCodes.map((code, i) => (
                            <span
                              key={`${deck.id}-${code}-${i}`}
                              className={`rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900 ${i === 0 ? "ml-2" : ""}`}
                              title={t("community.languageBadgesAria", { list: deckLangLabelList })}
                            >
                              {t(`deck.contentLang_${code}`)}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <span
                        className={`ml-2 align-middle rounded px-1.5 py-0.5 text-xs font-medium ${
                          deck.isPublic
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {deck.isPublic ? t("dashboard.shared") : t("dashboard.private")}
                      </span>
                      {deck.publicationStatus === "verified" ? (
                        <span className="ml-2 align-middle rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900">
                          {t("deckReview.badgeVerified")}
                        </span>
                      ) : deck.publicationStatus === "checked" ? (
                        <span className="ml-2 align-middle rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          {t("deckReview.badgeChecked")}
                        </span>
                      ) : deck.publicationStatus === "superseded" ? (
                        <span className="ml-2 align-middle rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
                          {t("deckReview.badgeSuperseded")}
                        </span>
                      ) : deck.publicationStatus === "draft" ? (
                        <span className="ml-2 align-middle rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          {t("deckReview.badgeDraft")}
                        </span>
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
                    </div>
                    <p className="text-sm text-stone-500">
                      {deck.itemCount} {t("dashboard.items", { count: deck.itemCount })}
                      {(deck.fieldOfInterest || deck.topic) && (
                        <span className="ml-2">
                          · {[deck.fieldOfInterest, deck.topic].filter(Boolean).join(" / ")}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/practice/${deck.id}`}
                      className="btn-secondary text-sm"
                    >
                      {t("common.practice")}
                    </Link>
                    {!mergeMode && (deck.publicationStatus === "checked" || deck.publicationStatus === "verified") ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleDuplicateForEdit(
                            deck.id,
                            (deck.publicationStatus === "checked" || deck.publicationStatus === "verified") && !!deck.isPublic
                          )
                        }
                        disabled={duplicatingDeckId !== null}
                        className="btn-secondary text-sm disabled:opacity-60"
                      >
                        {duplicatingDeckId === deck.id ? t("community.copying") : t("deck.duplicateToEdit")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteDeck(deck.id)}
                      className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </li>
              );
            })}
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
