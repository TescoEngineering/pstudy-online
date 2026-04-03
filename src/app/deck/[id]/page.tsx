"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

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
import { fetchDeck, saveDeckWithItems } from "@/lib/supabase/decks";
import { ExpandableField } from "@/components/ExpandableField";
import { PictureUpload } from "@/components/PictureUpload";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { useToast } from "@/components/Toast";
import { FIELDS_OF_INTEREST, getTopicsForField } from "@/lib/deck-attributes";

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

  const persistDeck = useCallback(
    async (updated: Deck) => {
      if (!updated) return;
      setSaving(true);
      try {
        await saveDeckWithItems(updated);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("common.failedToSave"));
      } finally {
        setSaving(false);
      }
    },
    [toast, t]
  );

  function updateDeckLocal(updates: Partial<Deck>) {
    if (!deck) return;
    const next = {
      ...deck,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    setDeck(next);
    persistDeck(next);
  }

  function updateTitleLocal(newTitle: string) {
    setTitle(newTitle);
    if (!deck) return;
    updateDeckLocal({ title: newTitle });
  }

  function updateItem(index: number, item: PStudyItem) {
    if (!deck) return;
    const items = [...deck.items];
    items[index] = item;
    updateDeckLocal({ items });
  }

  function addItem() {
    if (!deck) return;
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
    if (!deck) return;
    setRemoveItemIndex(index);
  }

  function confirmRemoveItem() {
    if (!deck || removeItemIndex === null) return;
    const items = deck.items.filter((_, i) => i !== removeItemIndex);
    updateDeckLocal({ items });
    setRemoveItemIndex(null);
  }

  function fillInstructionForAll(instructionText: string) {
    if (!deck || deck.items.length === 0) return;
    const v = instructionText.trim();
    const items = deck.items.map((item) => ({
      ...item,
      instruction: v,
    }));
    updateDeckLocal({ items });
  }

  async function sendReviewInvite() {
    if (!deck?.isPublic || deck.qualityStatus === "checked") return;
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 pt-3">
            <input
              type="text"
              value={title}
              onChange={(e) => updateTitleLocal(e.target.value)}
              className="min-w-[12rem] flex-1 rounded border border-stone-300 px-3 py-1.5 text-base font-semibold text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary sm:min-w-[16rem] sm:text-lg"
            />
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-sm text-stone-600">{t("deck.field")}:</label>
              <select
                value={deck?.fieldOfInterest ?? ""}
                onChange={(e) =>
                  updateDeckLocal({
                    fieldOfInterest: e.target.value || null,
                    topic: null,
                  })
                }
                className="max-w-[11rem] rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
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
              <label className="shrink-0 text-sm text-stone-600">{t("deck.topic")}:</label>
              <select
                value={deck?.topic ?? ""}
                onChange={(e) => updateDeckLocal({ topic: e.target.value || null })}
                className="max-w-[11rem] rounded border border-stone-300 px-2 py-1.5 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              >
                <option value="">—</option>
                {getTopicsForField(deck?.fieldOfInterest ?? null).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={deck?.isPublic ?? false}
                onChange={(e) => updateDeckLocal({ isPublic: e.target.checked })}
                className="rounded border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
              />
              {t("deck.shareWithCommunity")}
            </label>
            {deck?.isPublic && deck.qualityStatus === "checked" ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                {t("deckReview.badgeChecked")}
              </span>
            ) : null}
            {deck?.isPublic && deck.qualityStatus !== "checked" ? (
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
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
          <span className="text-stone-600">{deck.items.length} {t("dashboard.items", { count: deck.items.length })}</span>
          <button type="button" onClick={addItem} className="btn-primary text-sm">
            {t("deck.addItem")}
          </button>
          <Link href={`/exams/new?deck=${id}`} className="btn-secondary text-sm">
            {t("exam.newExam")}
          </Link>
          <Link href={`/practice/${id}`} className="btn-primary text-sm">
            {t("common.practice")}
          </Link>
          {deck?.isPublic && deck.qualityStatus !== "checked" ? (
            <button
              type="button"
              onClick={() => setReviewInviteOpen(true)}
              className="btn-secondary text-sm"
            >
              {t("deckReview.peerReview")}
            </button>
          ) : null}
          </div>
          <fieldset className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2">
            <legend className="px-1 text-xs font-medium text-stone-600">
              {t("deck.columnFiltersHint")}
            </legend>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
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
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
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
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
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
          </fieldset>
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
                      dictation={{}}
                    />
                  </td>
                  {columnFilters.mc ? (
                    <td className="p-2">
                      <div className="flex flex-col gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <ExpandableField
                            key={n}
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
                        value={item.keywords ?? ""}
                        onChange={(e) =>
                          updateItem(i, { ...item, keywords: e.target.value })
                        }
                        placeholder={t("deck.keywordsPlaceholder")}
                        className="w-full min-w-[6rem] rounded border border-stone-300 px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                        title={t("deck.keywordsHint")}
                      />
                    </td>
                  ) : null}
                  {columnFilters.instruction ? (
                    <td className="p-2">
                      <ExpandableField
                        value={item.instruction}
                        onChange={(v) =>
                          updateItem(i, { ...item, instruction: v })
                        }
                        placeholder={t("deck.instructionPlaceholder")}
                        rows={3}
                        compactClassName="w-full min-w-[6rem]"
                        onApplyToAll={(v) => fillInstructionForAll(v)}
                        applyToAllLabel={t("deck.fillThisInstructionForAll")}
                      />
                    </td>
                  ) : null}
                  <td className="p-2">
                    <PictureUpload
                      value={item.picture_url}
                      onChange={(url) =>
                        updateItem(i, { ...item, picture_url: url })
                      }
                    />
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-red-600 hover:underline"
                    >
                      {t("common.delete")}
                    </button>
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
              className="text-lg font-semibold text-stone-900"
            >
              {t("deckReview.requestTitle")}
            </h2>
            <p className="mt-2 text-sm text-stone-600">{t("deckReview.requestHint")}</p>
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
