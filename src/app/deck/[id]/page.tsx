"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Deck, PStudyItem } from "@/types/pstudy";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { fetchDeck, saveDeckWithItems } from "@/lib/supabase/decks";
import { ExpandableField } from "@/components/ExpandableField";
import { PictureUpload } from "@/components/PictureUpload";
import { ConfirmModal } from "@/components/ConfirmModal";
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
  const [fillInstruction, setFillInstruction] = useState("");
  const [removeItemIndex, setRemoveItemIndex] = useState<number | null>(null);
  const lastRowRef = useRef<HTMLTableRowElement>(null);
  const prevItemCountRef = useRef(-1);

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

  function fillInstructionForAll() {
    if (!deck || deck.items.length === 0) return;
    const items = deck.items.map((item) => ({
      ...item,
      instruction: fillInstruction.trim(),
    }));
    updateDeckLocal({ items });
    setFillInstruction("");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-600">{t("common.loading")}</p>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-600">{t("practice.deckNotFound")}</p>
        <Link href="/dashboard" className="ml-2 text-pstudy-primary hover:underline">
          {t("result.backToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            {t("deck.backToDashboard")}
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="text"
              value={title}
              onChange={(e) => updateTitleLocal(e.target.value)}
              className="rounded border border-stone-300 px-3 py-1 text-lg font-semibold focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-stone-600">{t("deck.field")}:</label>
              <select
                value={deck?.fieldOfInterest ?? ""}
                onChange={(e) =>
                  updateDeckLocal({
                    fieldOfInterest: e.target.value || null,
                    topic: null,
                  })
                }
                className="rounded border border-stone-300 px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
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
              <label className="text-sm text-stone-600">{t("deck.topic")}:</label>
              <select
                value={deck?.topic ?? ""}
                onChange={(e) => updateDeckLocal({ topic: e.target.value || null })}
                className="rounded border border-stone-300 px-2 py-1 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
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
            <span
              className={`inline-block min-w-[5rem] text-sm text-stone-500 ${saving ? "" : "invisible"}`}
              aria-hidden={!saving}
            >
              {t("deck.saving")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/exams/new?deck=${id}`} className="btn-secondary text-sm">
              {t("exam.newExam")}
            </Link>
            <Link href={`/practice/${id}`} className="btn-primary">
              {t("common.practice")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="text-stone-600">{deck.items.length} {t("dashboard.items", { count: deck.items.length })}</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-stone-600">{t("deck.fillInstructionForAll")}:</label>
            <input
              type="text"
              value={fillInstruction}
              onChange={(e) => setFillInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fillInstructionForAll()}
              placeholder={t("deck.fillInstructionPlaceholder")}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm min-w-[14rem] focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
            />
            <button
              onClick={fillInstructionForAll}
              disabled={deck.items.length === 0}
              className="rounded bg-stone-200 px-3 py-1.5 text-sm font-medium hover:bg-stone-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("deck.applyToAll")}
            </button>
          </div>
          <button onClick={addItem} className="btn-primary text-sm">
            {t("deck.addItem")}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-lg border border-stone-200 bg-white text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">{t("deck.description")}</th>
                <th className="p-2 font-medium">{t("deck.explanation")}</th>
                <th className="p-2 font-medium">MC 1–4</th>
                <th className="p-2 font-medium">{t("deck.instruction")}</th>
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
                    />
                  </td>
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
                  <td className="p-2">
                    <ExpandableField
                      value={item.instruction}
                      onChange={(v) =>
                        updateItem(i, { ...item, instruction: v })
                      }
                      placeholder={t("deck.instructionPlaceholder")}
                      rows={3}
                      compactClassName="w-full min-w-[6rem]"
                    />
                  </td>
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
    </div>
  );
}
