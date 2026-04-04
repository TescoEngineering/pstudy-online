"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";

const DECK_COLUMN_FILTERS_KEY = "pstudy-deck-column-filters";

type DeckColumnFilters = {
  mc: boolean;
  keywords: boolean;
  instruction: boolean;
};

const defaultColumnFilters: DeckColumnFilters = {
  mc: true,
  keywords: true,
  instruction: true,
};

function loadDeckColumnFilters(deckId: string): DeckColumnFilters {
  if (typeof window === "undefined") return defaultColumnFilters;
  try {
    const raw = localStorage.getItem(`${DECK_COLUMN_FILTERS_KEY}:${deckId}`);
    if (!raw) return defaultColumnFilters;
    const p = JSON.parse(raw) as Partial<DeckColumnFilters>;
    return {
      mc: typeof p.mc === "boolean" ? p.mc : true,
      keywords: typeof p.keywords === "boolean" ? p.keywords : true,
      instruction: typeof p.instruction === "boolean" ? p.instruction : true,
    };
  } catch {
    return defaultColumnFilters;
  }
}

function saveDeckColumnFilters(deckId: string, f: DeckColumnFilters) {
  try {
    localStorage.setItem(`${DECK_COLUMN_FILTERS_KEY}:${deckId}`, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}
import Link from "next/link";
import { Deck, PStudyItem } from "@/types/pstudy";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  DECK_CHECKED_READONLY,
  duplicateOwnedDeck,
  fetchDeck,
  saveDeckWithItems,
} from "@/lib/supabase/decks";
import { ExpandableField } from "@/components/ExpandableField";
import { PictureUpload } from "@/components/PictureUpload";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { ContextHint } from "@/components/ContextHint";
import { useToast } from "@/components/Toast";
import { FIELDS_OF_INTEREST, getTopicsForField } from "@/lib/deck-attributes";
import {
  DECK_CONTENT_LANGUAGE_CODES,
  deckContentLanguagesClassificationComplete,
  parseDeckContentLanguages,
  serializeDeckContentLanguages,
  type DeckContentLanguageCode,
} from "@/lib/deck-content-language";
import { deckIsReadOnlyPublication } from "@/lib/deck-publication";

function isClassificationComplete(
  d: Pick<Deck, "fieldOfInterest" | "topic" | "contentLanguage">
): boolean {
  return Boolean(
    d.fieldOfInterest?.trim() &&
      d.topic?.trim() &&
      deckContentLanguagesClassificationComplete(d.contentLanguage)
  );
}

export default function DeckEditorPage() {
  const params = useParams();
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const id = params.id as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeItemIndex, setRemoveItemIndex] = useState<number | null>(null);
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewInviteOpen, setReviewInviteOpen] = useState(false);
  const lastRowRef = useRef<HTMLTableRowElement>(null);
  const prevItemCountRef = useRef(-1);
  const [columnFilters, setColumnFilters] = useState<DeckColumnFilters>(defaultColumnFilters);
  const skipNextColumnSaveRef = useRef(true);
  const [wantsShare, setWantsShare] = useState(false);
  const wantsShareRef = useRef(false);
  const shareUiInitializedForDeckId = useRef<string | null>(null);
  const [communityShareOpen, setCommunityShareOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const [duplicatingDeck, setDuplicatingDeck] = useState(false);
  const [resubmittingReview, setResubmittingReview] = useState(false);

  const deckContentLangCodes = useMemo(
    () => parseDeckContentLanguages(deck?.contentLanguage),
    [deck?.contentLanguage]
  );
  const deckFirstContentLang = deckContentLangCodes[0] ?? "";
  const deckSecondContentLang = deckContentLangCodes[1] ?? "";

  const columnFilterSummary = useMemo(() => {
    const n =
      (columnFilters.mc ? 1 : 0) +
      (columnFilters.keywords ? 1 : 0) +
      (columnFilters.instruction ? 1 : 0);
    if (n === 0) return t("deck.columnFiltersSummaryNone");
    if (n === 3) return t("deck.columnFiltersSummaryAll");
    const parts: string[] = [];
    if (columnFilters.mc) parts.push(t("deck.showMcColumn"));
    if (columnFilters.keywords) parts.push(t("deck.showKeywordsColumn"));
    if (columnFilters.instruction) parts.push(t("deck.showInstructionColumn"));
    return parts.join(", ");
  }, [columnFilters, t]);

  useEffect(() => {
    wantsShareRef.current = wantsShare;
  }, [wantsShare]);

  useEffect(() => {
    if (!columnMenuOpen) return;
    function onDocDown(e: MouseEvent) {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setColumnMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnMenuOpen]);

  useEffect(() => {
    skipNextColumnSaveRef.current = true;
    setColumnFilters(loadDeckColumnFilters(id));
  }, [id]);

  useEffect(() => {
    if (skipNextColumnSaveRef.current) {
      skipNextColumnSaveRef.current = false;
      return;
    }
    saveDeckColumnFilters(id, columnFilters);
  }, [id, columnFilters]);

  useEffect(() => {
    if (!deck) return;
    if (prevItemCountRef.current === -1) {
      prevItemCountRef.current = deck.items.length;
      return;
    }
    if (deck.items.length > prevItemCountRef.current) {
      lastRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevItemCountRef.current = deck.items.length;
  }, [deck?.items.length]);

  useEffect(() => {
    if (!reviewInviteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReviewInviteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reviewInviteOpen]);

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
      const d = await fetchDeck(id);
      setDeck(d ?? null);
      if (d) setTitle(d.title);
      setLoading(false);
    }
    load();
  }, [id, router]);

  useEffect(() => {
    if (!deck) return;
    if (shareUiInitializedForDeckId.current !== deck.id) {
      shareUiInitializedForDeckId.current = deck.id;
      const pub = deck.isPublic ?? false;
      setWantsShare(pub);
      wantsShareRef.current = pub;
    }
  }, [deck]);

  const persistDeck = useCallback(
    async (updated: Deck) => {
      if (!updated) return;
        if (
          updated.publicationStatus === "checked" ||
          updated.publicationStatus === "superseded"
        )
          return;
      setSaving(true);
      try {
        await saveDeckWithItems(updated);
      } catch (err) {
        if (err instanceof Error && err.message === DECK_CHECKED_READONLY) {
          toast.error(t("deck.checkedCannotSave"));
        } else {
          toast.error(err instanceof Error ? err.message : t("common.failedToSave"));
        }
      } finally {
        setSaving(false);
      }
    },
    [toast, t]
  );

  function updateDeckLocal(updates: Partial<Deck>) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const merged = {
      ...deck,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const next: Deck = {
      ...merged,
      isPublic: Boolean(wantsShareRef.current && isClassificationComplete(merged)),
    };
    setDeck(next);
    void persistDeck(next);
  }

  function handleShareToggle(checked: boolean) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setWantsShare(checked);
    wantsShareRef.current = checked;
    const merged = {
      ...deck,
      updatedAt: new Date().toISOString(),
    };
    const next: Deck = {
      ...merged,
      isPublic: Boolean(checked && isClassificationComplete(merged)),
    };
    setDeck(next);
    void persistDeck(next);
    if (checked && !isClassificationComplete(merged)) {
      toast.toast(t("deck.shareFillClassification"));
    }
  }

  function updateTitleLocal(newTitle: string) {
    if (deck && deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setTitle(newTitle);
    if (!deck) return;
    updateDeckLocal({ title: newTitle });
  }

  function updateItem(index: number, item: PStudyItem) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const items = [...deck.items];
    items[index] = item;
    updateDeckLocal({ items });
  }

  function addItem() {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const newItem: PStudyItem = {
      id: crypto.randomUUID(),
      description: "",
      explanation: "",
      multiplechoice1: "",
      multiplechoice2: "",
      multiplechoice3: "",
      multiplechoice4: "",
      picture_url: "",
      instruction: "",
      keywords: "",
    };
    updateDeckLocal({ items: [...deck.items, newItem] });
  }

  function removeItem(index: number) {
    if (!deck || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    setRemoveItemIndex(index);
  }

  function confirmRemoveItem() {
    if (!deck || removeItemIndex === null || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft"))
      return;
    const items = deck.items.filter((_, i) => i !== removeItemIndex);
    updateDeckLocal({ items });
    setRemoveItemIndex(null);
  }

  function fillInstructionForAll(instructionText: string) {
    if (!deck || deck.items.length === 0 || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft"))
      return;
    const v = instructionText.trim();
    const items = deck.items.map((item) => ({
      ...item,
      instruction: v,
    }));
    updateDeckLocal({ items });
  }

  async function sendReviewInvite() {
    if (!deck?.isPublic || deckIsReadOnlyPublication(deck.publicationStatus ?? "draft")) return;
    const email = reviewEmail.trim();
    if (!email) {
      toast.error(t("deckReview.emailRequired"));
      return;
    }
    setReviewSending(true);
    try {
      const res = await fetch("/api/deck-review/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deckId: id, reviewerEmail: email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "invite failed");
      toast.success(
        data.emailed ? t("deckReview.inviteSent") : t("deckReview.inviteCreatedNoEmail")
      );
      setReviewEmail("");
      setReviewInviteOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("deckReview.inviteFailed"));
    } finally {
      setReviewSending(false);
    }
  }

  async function handleResubmitForReview() {
    if (!deck?.id || resubmittingReview) return;
    setResubmittingReview(true);
    try {
      const res = await fetch("/api/deck-review/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: deck.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "resubmit failed");
      setDeck((d) =>
        d ? { ...d, reviewStatus: "resubmitted" as const } : d
      );
      toast.success(t("deckReview.resubmitSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setResubmittingReview(false);
    }
  }

  async function handleDuplicateForEdit() {
    if (!deck || duplicatingDeck) return;
    setDuplicatingDeck(true);
    try {
      const d = await duplicateOwnedDeck(deck.id, {
        publicNextRevision: deck.publicationStatus === "checked" && !!deck.isPublic,
      });
      router.push(`/deck/${d.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setDuplicatingDeck(false);
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

  if (!deck) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <p className="text-stone-600">{t("practice.deckNotFound")}</p>
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            {t("result.backToDashboard")}
          </Link>
        </div>
        <HelpNavLink />
      </div>
    );
  }

  const deckLocked = deck ? deckIsReadOnlyPublication(deck.publicationStatus ?? "draft") : false;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Logo size="sm" withText />
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
                {t("dashboard.myDecks")}
              </Link>
              <Link href="/community" className="text-stone-600 hover:text-pstudy-primary">
                {t("dashboard.community")}
              </Link>
              <HelpNavLink />
            </nav>
          </div>
          <div className="space-y-3 border-t border-stone-100 pt-3">
            <input
              type="text"
              value={title}
              readOnly={deckLocked}
              onChange={(e) => updateTitleLocal(e.target.value)}
              title={deckLocked ? t("deck.checkedCannotEditTitle") : undefined}
              className={`w-full max-w-3xl rounded border px-3 py-1.5 text-base font-semibold focus:outline-none focus:ring-1 sm:text-lg ${
                deckLocked
                  ? "cursor-default border-stone-200 bg-stone-50 text-stone-800"
                  : "border-stone-300 text-stone-900 focus:border-pstudy-primary focus:ring-pstudy-primary"
              }`}
            />
            {deckLocked ? (
              <div className="w-full max-w-3xl rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3 text-sm text-stone-800">
                <p className="font-medium text-emerald-900">{t("deck.communitySharingSection")}</p>
                <p className="mt-1 text-stone-700">{t("deck.checkedCommunitySectionHint")}</p>
                {deck.isPublic ? (
                  <dl className="mt-3 grid gap-1 text-stone-700 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                    <dt className="text-stone-500">{t("deck.field")}</dt>
                    <dd>{deck.fieldOfInterest ?? "—"}</dd>
                    <dt className="text-stone-500">{t("deck.topic")}</dt>
                    <dd>{deck.topic ?? "—"}</dd>
                    <dt className="text-stone-500">{t("deck.contentLanguage")}</dt>
                    <dd>
                      {deckContentLangCodes.length > 0
                        ? deckContentLangCodes
                            .map((code) => t(`deck.contentLang_${code}`))
                            .join(`${t("deck.contentLanguagePairSeparator")}`)
                        : "—"}
                    </dd>
                  </dl>
                ) : null}
              </div>
            ) : (
            <details
              className="w-full max-w-3xl rounded border border-stone-200 bg-white px-3 py-2"
              open={communityShareOpen}
              onToggle={(e) => setCommunityShareOpen(e.currentTarget.open)}
            >
              <summary className="cursor-pointer select-none text-sm font-medium text-stone-700 outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2">
                {t("deck.communitySharingSection")}
              </summary>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={wantsShare}
                      onChange={(e) => handleShareToggle(e.target.checked)}
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.shareWithCommunity")}
                  </label>
                  {deck?.isPublic && deck.publicationStatus === "checked" ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                      {t("deckReview.badgeChecked")}
                    </span>
                  ) : null}
                  {deck?.isPublic && deck.publicationStatus === "draft" ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                      {t("deckReview.badgeDraft")}
                    </span>
                  ) : null}
                  <span
                    className={`inline-block min-w-[5rem] text-sm text-stone-500 ${saving ? "" : "invisible"}`}
                    aria-hidden={!saving}
                  >
                    {t("deck.saving")}
                  </span>
                </div>
                {wantsShare ? (
                  <div className="space-y-2">
                    <fieldset className="rounded-xl border-2 border-teal-200/70 bg-teal-50/30 px-3 py-3">
                      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-teal-900">
                        {t("deck.toolbarClassification")}
                      </legend>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center gap-2">
                          <label className="shrink-0 text-sm text-stone-600" htmlFor="deck-field">
                            {t("deck.field")}:
                          </label>
                          <select
                            id="deck-field"
                            value={deck?.fieldOfInterest ?? ""}
                            onChange={(e) =>
                              updateDeckLocal({
                                fieldOfInterest: e.target.value || null,
                                topic: null,
                              })
                            }
                            aria-invalid={!deck?.fieldOfInterest?.trim()}
                            className="w-[11rem] max-w-[min(11rem,100vw-6rem)] rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                          >
                            <option value="">—</option>
                            {FIELDS_OF_INTEREST.map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="shrink-0 text-sm text-stone-600" htmlFor="deck-topic">
                            {t("deck.topic")}:
                          </label>
                          <select
                            id="deck-topic"
                            value={deck?.topic ?? ""}
                            onChange={(e) => updateDeckLocal({ topic: e.target.value || null })}
                            aria-invalid={!deck?.topic?.trim()}
                            className="w-[11rem] max-w-[min(11rem,100vw-6rem)] rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                          >
                            <option value="">—</option>
                            {getTopicsForField(deck?.fieldOfInterest ?? null).map((top) => (
                              <option key={top} value={top}>
                                {top}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <div className="flex items-center gap-2">
                            <label className="shrink-0 text-sm text-stone-600" htmlFor="deck-content-lang-1">
                              {t("deck.contentLanguage")}:
                            </label>
                            <select
                              id="deck-content-lang-1"
                              data-testid="deck-language-select"
                              value={deckFirstContentLang}
                              title={t("deck.contentLanguageHint")}
                              aria-label={t("deck.contentLanguage")}
                              aria-invalid={!deckContentLanguagesClassificationComplete(deck?.contentLanguage ?? null)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const nextFirst =
                                  raw === "" ? null : (raw as DeckContentLanguageCode);
                                const prev = parseDeckContentLanguages(deck?.contentLanguage ?? null);
                                const oldSecond = prev[1] ?? null;
                                const second =
                                  nextFirst && oldSecond && oldSecond !== nextFirst
                                    ? oldSecond
                                    : null;
                                updateDeckLocal({
                                  contentLanguage: serializeDeckContentLanguages([nextFirst, second]),
                                });
                              }}
                              className="w-[11rem] max-w-[min(11rem,100vw-6rem)] rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                            >
                              <option value="">—</option>
                              {DECK_CONTENT_LANGUAGE_CODES.map((code) => (
                                <option key={code} value={code}>
                                  {t(`deck.contentLang_${code}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="shrink-0 text-sm text-stone-600" htmlFor="deck-content-lang-2">
                              {t("community.secondLanguageFilter")}:
                            </label>
                            <select
                              id="deck-content-lang-2"
                              data-testid="deck-language-select-second"
                              value={deckSecondContentLang}
                              disabled={!deckFirstContentLang}
                              title={t("deck.contentLanguageSecondHint")}
                              aria-label={t("community.secondLanguageFilter")}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const first = deckFirstContentLang
                                  ? (deckFirstContentLang as DeckContentLanguageCode)
                                  : null;
                                const second =
                                  raw === "" || raw === deckFirstContentLang
                                    ? null
                                    : (raw as DeckContentLanguageCode);
                                updateDeckLocal({
                                  contentLanguage: serializeDeckContentLanguages([first, second]),
                                });
                              }}
                              className="w-[11rem] max-w-[min(11rem,100vw-6rem)] rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                            >
                              <option value="">{t("deck.contentLanguageSecondNone")}</option>
                              {DECK_CONTENT_LANGUAGE_CODES.filter((code) => code !== deckFirstContentLang).map(
                                (code) => (
                                  <option key={code} value={code}>
                                    {t(`deck.contentLang_${code}`)}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </fieldset>
                    {!isClassificationComplete(deck) ? (
                      <p className="text-sm text-amber-800">{t("deck.shareIncompleteHint")}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </details>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {deckLocked ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-stone-800">
            <p className="font-semibold text-emerald-950">{t("deck.checkedReadOnlyTitle")}</p>
            <p className="mt-1 text-stone-700">{t("deck.checkedReadOnlyBody")}</p>
            <button
              type="button"
              className="btn-primary mt-3 text-sm disabled:opacity-50"
              disabled={duplicatingDeck}
              onClick={() => void handleDuplicateForEdit()}
            >
              {duplicatingDeck ? t("community.copying") : t("deck.duplicateToEdit")}
            </button>
          </div>
        ) : null}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <span className="text-stone-600">{deck.items.length} {t("dashboard.items", { count: deck.items.length })}</span>
          {!deckLocked ? (
          <button type="button" onClick={addItem} className="btn-primary text-sm">
            {t("deck.addItem")}
          </button>
          ) : null}
          <Link href={`/exams/new?deck=${id}`} className="btn-secondary text-sm">
            {t("exam.newExam")}
          </Link>
          <Link href={`/practice/${id}`} className="btn-primary text-sm">
            {t("common.practice")}
          </Link>
          <div className="relative" ref={columnMenuRef}>
            <button
              type="button"
              data-testid="deck-column-filters-trigger"
              aria-label={t("deck.columnFiltersLegend")}
              aria-expanded={columnMenuOpen}
              aria-haspopup="dialog"
              title={t("deck.columnFiltersHint")}
              className="flex w-[min(14rem,calc(100vw-8rem))] min-w-[10rem] items-center justify-between gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-left text-sm text-stone-900 shadow-sm hover:border-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              onClick={() => setColumnMenuOpen((o) => !o)}
            >
              <span className="min-w-0 flex-1 truncate">{columnFilterSummary}</span>
              <span className="shrink-0 text-stone-400" aria-hidden>
                ▾
              </span>
            </button>
            {columnMenuOpen ? (
              <div
                className="absolute left-0 z-50 mt-1 w-max min-w-full max-w-[18rem] rounded-lg border border-stone-200 bg-white py-2 shadow-lg"
                role="dialog"
                aria-label={t("deck.columnFiltersLegend")}
              >
                <div className="px-2">
                  <p className="mb-2 px-2 text-xs text-stone-500">{t("deck.columnFiltersHint")}</p>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={columnFilters.mc}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, mc: e.target.checked }))
                      }
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.showMcColumn")}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={columnFilters.keywords}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, keywords: e.target.checked }))
                      }
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.showKeywordsColumn")}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={columnFilters.instruction}
                      onChange={(e) =>
                        setColumnFilters((f) => ({ ...f, instruction: e.target.checked }))
                      }
                      className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    />
                    {t("deck.showInstructionColumn")}
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          {deck?.isPublic && deck.publicationStatus === "draft" ? (
            <>
              <button
                type="button"
                onClick={() => setReviewInviteOpen(true)}
                className="btn-secondary text-sm"
              >
                {t("deckReview.peerReview")}
              </button>
              {deck.reviewStatus === "revise_and_resubmit" && !deckLocked ? (
                <button
                  type="button"
                  disabled={resubmittingReview}
                  onClick={() => void handleResubmitForReview()}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {resubmittingReview ? t("common.loading") : t("deckReview.resubmitForReview")}
                </button>
              ) : null}
            </>
          ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-lg border border-stone-200 bg-white text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">{t("deck.description")}</th>
                <th className="p-2 font-medium">{t("deck.explanation")}</th>
                {columnFilters.mc ? (
                  <th className="p-2 font-medium">MC 1–4</th>
                ) : null}
                {columnFilters.keywords ? (
                  <th className="p-2 font-medium min-w-[6rem]">{t("deck.keywords")}</th>
                ) : null}
                {columnFilters.instruction ? (
                  <th className="p-2 font-medium">{t("deck.instruction")}</th>
                ) : null}
                <th className="p-2 font-medium">{t("deck.picture")}</th>
                <th className="w-24 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {deck.items.map((item, i) => (
                <tr
                  key={item.id}
                  ref={i === deck.items.length - 1 ? lastRowRef : undefined}
                  className="border-b border-stone-100"
                >
                  <td className="p-2 text-stone-500">{i + 1}</td>
                  <td className="p-2">
                    <ExpandableField
                      readOnly={deckLocked}
                      value={item.description}
                      onChange={(v) =>
                        updateItem(i, { ...item, description: v })
                      }
                      placeholder={t("deck.questionPlaceholder")}
                      compactClassName="w-full min-w-[8rem]"
                      saveOnEnter={false}
                    />
                  </td>
                  <td className="p-2">
                    <ExpandableField
                      readOnly={deckLocked}
                      value={item.explanation}
                      onChange={(v) =>
                        updateItem(i, { ...item, explanation: v })
                      }
                      placeholder={t("deck.answerPlaceholder")}
                      compactClassName="w-full min-w-[8rem]"
                      saveOnEnter={false}
                      keywordTagging={{
                        keywords: item.keywords ?? "",
                        onKeywordsChange: (next) =>
                          updateItem(i, { ...item, keywords: next }),
                      }}
                      dictation={deckLocked ? undefined : {}}
                    />
                  </td>
                  {columnFilters.mc ? (
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <ExpandableField
                            key={n}
                            readOnly={deckLocked}
                            value={
                              item[
                                `multiplechoice${n}` as keyof PStudyItem
                              ] as string
                            }
                            onChange={(v) =>
                              updateItem(i, {
                                ...item,
                                [`multiplechoice${n}`]: v,
                              })
                            }
                            placeholder={`MC ${n}`}
                            rows={3}
                            compactRows={1}
                            compactClassName="min-w-[6rem] text-xs py-0.5"
                          />
                        ))}
                      </div>
                    </td>
                  ) : null}
                  {columnFilters.keywords ? (
                    <td className="p-2">
                      <input
                        type="text"
                        readOnly={deckLocked}
                        value={item.keywords ?? ""}
                        onChange={(e) =>
                          updateItem(i, { ...item, keywords: e.target.value })
                        }
                        placeholder={t("deck.keywordsPlaceholder")}
                        className={`w-full min-w-[6rem] rounded border px-2 py-1 text-sm ${
                          deckLocked
                            ? "cursor-default border-stone-100 bg-stone-50 text-stone-700"
                            : "border-stone-300 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                        }`}
                        title={t("deck.keywordsHint")}
                      />
                    </td>
                  ) : null}
                  {columnFilters.instruction ? (
                    <td className="p-2">
                      <ExpandableField
                        readOnly={deckLocked}
                        value={item.instruction}
                        onChange={(v) =>
                          updateItem(i, { ...item, instruction: v })
                        }
                        placeholder={t("deck.instructionPlaceholder")}
                        rows={3}
                        compactClassName="w-full min-w-[6rem]"
                        onApplyToAll={
                          deckLocked
                            ? undefined
                            : (v) => fillInstructionForAll(v)
                        }
                        applyToAllLabel={t("deck.fillThisInstructionForAll")}
                      />
                    </td>
                  ) : null}
                  <td className="p-2">
                    <PictureUpload
                      readOnly={deckLocked}
                      value={item.picture_url}
                      onChange={(url) =>
                        updateItem(i, { ...item, picture_url: url })
                      }
                    />
                  </td>
                  <td className="p-2">
                    {!deckLocked ? (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-600 hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <ConfirmModal
        open={removeItemIndex !== null}
        onClose={() => setRemoveItemIndex(null)}
        onConfirm={confirmRemoveItem}
        title={t("deck.removeItemConfirm")}
        confirmLabel={t("common.remove")}
      />

      {reviewInviteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && setReviewInviteOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-invite-dialog-title"
          >
            <h2
              id="review-invite-dialog-title"
              className="flex flex-wrap items-center gap-2 text-lg font-semibold text-stone-900"
            >
              {t("deckReview.requestTitle")}
              <ContextHint>
                <p className="m-0 text-sm">{t("deckReview.requestHint")}</p>
              </ContextHint>
            </h2>
            <div className="mt-4">
              <label htmlFor="review-email" className="mb-1 block text-xs font-medium text-stone-600">
                {t("deckReview.reviewerEmail")}
              </label>
              <input
                id="review-email"
                type="email"
                value={reviewEmail}
                onChange={(e) => setReviewEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                placeholder={t("deckReview.reviewerEmailPlaceholder")}
                className="w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void sendReviewInvite();
                  }
                }}
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewInviteOpen(false)}
                className="btn-secondary"
                disabled={reviewSending}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void sendReviewInvite()}
                disabled={reviewSending}
                className="btn-primary disabled:opacity-50"
              >
                {reviewSending ? t("deckReview.sending") : t("deckReview.sendInvite")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
