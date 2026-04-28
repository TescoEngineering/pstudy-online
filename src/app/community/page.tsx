"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Deck } from "@/types/pstudy";
import { createClient } from "@/lib/supabase/client";
import { fetchPublicDecks, copyDeckToMine, type PublicDecksFilters } from "@/lib/supabase/decks";
import { useToast } from "@/components/Toast";
import { Logo } from "@/components/Logo";
import { ContextHint } from "@/components/ContextHint";
import { FIELDS_OF_INTEREST, getTopicsForField, getAllTopics } from "@/lib/deck-attributes";
import { DECK_CONTENT_LANGUAGE_CODES, parseDeckContentLanguages } from "@/lib/deck-content-language";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

export default function CommunityPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [languageFilters, setLanguageFilters] = useState<string[]>([]);
  const [includeNoLanguage, setIncludeNoLanguage] = useState(true);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

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
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setLoading(true);
      try {
        const filters: PublicDecksFilters = {};
        if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
        if (fieldFilter) filters.fieldOfInterest = fieldFilter;
        if (topicFilter) filters.topic = topicFilter;
        if (languageFilters.length > 0) {
          filters.languages = languageFilters;
          filters.includeUnspecifiedLanguage = includeNoLanguage;
        }
        const data = await fetchPublicDecks(Object.keys(filters).length ? filters : undefined);
        setDecks(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, debouncedSearch, fieldFilter, topicFilter, languageFilters, includeNoLanguage]);

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

  async function handleCopy(deckId: string) {
    setCopyingId(deckId);
    try {
      const newDeck = await copyDeckToMine(deckId);
      router.push(`/deck/${newDeck.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.failedToCopyDeck"));
    } finally {
      setCopyingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/dashboard">{t("dashboard.myDecks")}</AppHeaderLink>
            <AppHeaderLink href="/school">{t("dashboard.school")}</AppHeaderLink>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
          </>
        }
      />

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="text-2xl font-bold text-stone-900">{t("community.title")}</h1>
          <ContextHint>
            <p className="m-0">{t("community.browseHint")}</p>
          </ContextHint>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-sm text-stone-600">{t("community.searchByTitle")}</label>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("community.searchPlaceholder")}
                className="w-64 rounded-lg border border-stone-300 px-4 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
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
              <span className="mb-1 block text-sm text-stone-600" id="community-deck-lang-label">
                {t("deck.contentLanguage")}
              </span>
              <button
                type="button"
                id="community-deck-lang-trigger"
                aria-labelledby="community-deck-lang-label"
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

        {loading ? (
          <p className="text-stone-600">{t("common.loading")}</p>
        ) : decks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4 flex flex-wrap items-center justify-center gap-2">
              <span>{t("community.noSharedDecks")}</span>
              <ContextHint>
                <p className="m-0">{t("community.shareHint")}</p>
              </ContextHint>
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => {
              const deckLangCodes = parseDeckContentLanguages(deck.contentLanguage);
              const deckLangLabelList = deckLangCodes
                .map((c) => t(`deck.contentLang_${c}`))
                .join(t("deck.contentLanguagePairSeparator"));
              return (
              <li key={deck.id} className="card flex items-center justify-between">
                <div>
                  <span className="font-semibold text-stone-900">{deck.title}</span>
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
                  {deck.publicationStatus === "checked" ? (
                    <span className="ml-2 align-middle rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {t("deckReview.badgeChecked")}
                    </span>
                  ) : (
                    <span className="ml-2 align-middle rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {t("deckReview.badgeDraft")}
                    </span>
                  )}
                  <p className="text-sm text-stone-500">
                    {deck.itemCount} {t("dashboard.items", { count: deck.itemCount })}
                    {(deck.fieldOfInterest || deck.topic) && (
                      <span className="ml-2">
                        · {[deck.fieldOfInterest, deck.topic].filter(Boolean).join(" / ")}
                      </span>
                    )}
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
                    onClick={() => handleCopy(deck.id)}
                    disabled={copyingId !== null}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {copyingId === deck.id ? t("community.copying") : t("community.copyToMyDecks")}
                  </button>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
