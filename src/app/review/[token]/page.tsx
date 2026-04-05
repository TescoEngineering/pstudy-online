"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Deck, PStudyItem } from "@/types/pstudy";
import { ExpandableField } from "@/components/ExpandableField";
import { PictureUpload } from "@/components/PictureUpload";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { useToast } from "@/components/Toast";

export default function DeckReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);

  const tokenStr = Array.isArray(params.token)
    ? (params.token[0] ?? "")
    : (params.token ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deck-review/session?token=${encodeURIComponent(tokenStr)}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : t("deckReview.loadFailed"));
        setDeck(null);
        return;
      }
      setDeck(data.deck as Deck);
    } catch {
      toast.error(t("deckReview.loadFailed"));
      setDeck(null);
    } finally {
      setLoading(false);
    }
  }, [tokenStr]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateItem(index: number, item: PStudyItem) {
    if (!deck) return;
    const items = [...deck.items];
    items[index] = item;
    setDeck({ ...deck, items });
  }

  async function handleSave() {
    if (!deck) return;
    setSaving(true);
    try {
      const res = await fetch("/api/deck-review/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenStr, items: deck.items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "save failed");
      toast.success(t("deckReview.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  const awaitingAuthorRevision = deck?.reviewStatus === "revise_and_resubmit";
  const canRequestPublicationChanges = deck?.publicationStatus === "draft" && !awaitingAuthorRevision;

  async function handleRequestChangesSend() {
    if (!deck) return;
    setRequestingChanges(true);
    try {
      const res = await fetch("/api/deck-review/request-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenStr, message: requestNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "request failed");
      toast.success(t("deckReview.requestChangesSuccess"));
      setRequestModalOpen(false);
      setRequestNote("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("deckReview.requestChangesFailed"));
    } finally {
      setRequestingChanges(false);
    }
  }

  async function handleComplete() {
    if (!deck || awaitingAuthorRevision) return;
    if (!window.confirm(t("deckReview.confirmComplete"))) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/deck-review/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "complete failed");
      toast.success(t("deckReview.completed"));
      router.push("/community");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("deckReview.completeFailed"));
    } finally {
      setCompleting(false);
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
      <div className="min-h-screen bg-stone-50 px-4 py-12 text-center">
        <p className="text-stone-600">{t("deckReview.unavailable")}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
          <Link href="/community" className="text-pstudy-primary hover:underline">
            {t("community.title")}
          </Link>
          <HelpNavLink />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {requestModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => e.target === e.currentTarget && !requestingChanges && setRequestModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-semibold text-stone-900">
              {t("deckReview.requestChangesTitle")}
            </h3>
            <p className="mb-4 text-sm text-stone-600">{t("deckReview.requestChangesBody")}</p>
            <textarea
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              rows={4}
              placeholder={t("deckReview.feedbackOptionalPlaceholder")}
              className="mb-4 w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              disabled={requestingChanges}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !requestingChanges && setRequestModalOpen(false)}
                className="btn-secondary"
                disabled={requestingChanges}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(t("deckReview.confirmRequestChanges"))) return;
                  void handleRequestChangesSend();
                }}
                disabled={requestingChanges}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {requestingChanges ? t("deckReview.requestingChanges") : t("deckReview.requestChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo size="sm" withText />
          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/community" className="text-stone-600 hover:text-pstudy-primary">
              {t("community.title")}
            </Link>
            <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.myDecks")}
            </Link>
            <HelpNavLink />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">{t("deckReview.bannerTitle")}</p>
          <p className="mt-1 text-amber-900/90">{t("deckReview.bannerBody")}</p>
          {awaitingAuthorRevision && (
            <p className="mt-2 font-medium text-amber-950">{t("deckReview.completeDisabledUntilResubmit")}</p>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">{deck.title}</h1>
            <p className="text-sm text-stone-500">
              {deck.items.length} {t("dashboard.items", { count: deck.items.length })}
              {(deck.fieldOfInterest || deck.topic) && (
                <span className="ml-2">
                  · {[deck.fieldOfInterest, deck.topic].filter(Boolean).join(" / ")}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {saving ? t("deck.saving") : t("deckReview.saveCorrections")}
            </button>
            {canRequestPublicationChanges && (
              <button
                type="button"
                onClick={() => setRequestModalOpen(true)}
                className="btn-secondary text-sm"
              >
                {t("deckReview.requestChanges")}
              </button>
            )}
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing || awaitingAuthorRevision}
              title={
                awaitingAuthorRevision ? t("deckReview.completeDisabledUntilResubmit") : undefined
              }
              className="btn-primary text-sm disabled:opacity-50"
            >
              {completing ? t("deckReview.completing") : t("deckReview.markChecked")}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-lg border border-stone-200 bg-white text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">{t("deck.description")}</th>
                <th className="p-2 font-medium">{t("deck.explanation")}</th>
                <th className="p-2 font-medium">MC 1–4</th>
                <th className="p-2 font-medium min-w-[6rem]">{t("deck.keywords")}</th>
                <th className="p-2 font-medium">{t("deck.instruction")}</th>
                <th className="p-2 font-medium">{t("deck.picture")}</th>
              </tr>
            </thead>
            <tbody>
              {deck.items.map((item, i) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="p-2 text-stone-500">{i + 1}</td>
                  <td className="p-2">
                    <ExpandableField
                      value={item.description}
                      onChange={(v) => updateItem(i, { ...item, description: v })}
                      placeholder={t("deck.questionPlaceholder")}
                      compactClassName="w-full min-w-[8rem]"
                      saveOnEnter={false}
                    />
                  </td>
                  <td className="p-2">
                    <ExpandableField
                      value={item.explanation}
                      onChange={(v) => updateItem(i, { ...item, explanation: v })}
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
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {[1, 2, 3, 4].map((n) => (
                        <ExpandableField
                          key={n}
                          value={item[`multiplechoice${n}` as keyof PStudyItem] as string}
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
                  <td className="p-2">
                    <ExpandableField
                      value={item.instruction}
                      onChange={(v) => updateItem(i, { ...item, instruction: v })}
                      placeholder={t("deck.instructionPlaceholder")}
                      rows={3}
                      compactClassName="w-full min-w-[6rem]"
                    />
                  </td>
                  <td className="p-2">
                    <PictureUpload
                      value={item.picture_url}
                      onChange={(url) => updateItem(i, { ...item, picture_url: url })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
