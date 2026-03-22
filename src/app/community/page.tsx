"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Deck } from "@/types/pstudy";
import { createClient } from "@/lib/supabase/client";
import { fetchPublicDecks, copyDeckToMine, type PublicDecksFilters } from "@/lib/supabase/decks";
import { useToast } from "@/components/Toast";
import { Logo } from "@/components/Logo";
import { FIELDS_OF_INTEREST, getTopicsForField, getAllTopics } from "@/lib/deck-attributes";

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
  const [copyingId, setCopyingId] = useState<string | null>(null);

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
        const data = await fetchPublicDecks(Object.keys(filters).length ? filters : undefined);
        setDecks(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router, debouncedSearch, fieldFilter, topicFilter]);

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
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Logo size="sm" withText />
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.myDecks")}
            </Link>
            <Link href="/import" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.importTxt")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-stone-900">{t("community.title")}</h1>
        <p className="mb-6 text-stone-600">
          {t("community.browseHint")}
        </p>

        <div className="mb-6 flex flex-wrap items-end gap-4">
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
              {(fieldFilter ? getTopicsForField(fieldFilter) : getAllTopics()).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-stone-600">{t("common.loading")}</p>
        ) : decks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">{t("community.noSharedDecks")}</p>
            <p>
              {t("community.shareHint")}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => (
              <li key={deck.id} className="card flex items-center justify-between">
                <div>
                  <span className="font-semibold text-stone-900">{deck.title}</span>
                  <p className="text-sm text-stone-500">
                    {deck.items.length} {t("dashboard.items", { count: deck.items.length })}
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
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
