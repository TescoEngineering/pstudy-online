"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { formatPStudyRowsAsTxt, parsePStudyTxt } from "@/lib/txt-import";
import {
  DECK_GENERATION_LANGUAGE_CODES,
  MAX_DOCUMENT_CHARS,
  type DeckGenerationLanguage,
  type GenerateOutputMode,
  type McWrongOptionCount,
  splitGeneratedItemsByPracticeKind,
} from "@/lib/ai-deck-generate";
import { Deck, PStudyItem } from "@/types/pstudy";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createDeck, saveDeckWithItems } from "@/lib/supabase/decks";
import { useToast } from "@/components/Toast";

/** Shared shell for .txt drop / paste / browse (Import section and AI empty state). */
const TXT_IMPORT_DROP_ZONE_CLASS =
  "flex min-h-[12rem] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white p-8 text-center transition hover:border-pstudy-primary hover:bg-teal-50/30";

function sanitizeAiExportBasename(title: string): string {
  const t = title.trim().slice(0, 80) || "pstudy-generated";
  return t
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

function downloadUtf8TextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** When the API returns `itemsFull`, offer both the uncapped list and the capped deck as PSTUDY .txt downloads. */
function downloadAiPstudyTxtPair(
  baseTitle: string,
  itemsFull: Omit<PStudyItem, "id">[],
  itemsCapped: Omit<PStudyItem, "id">[],
  afterSecondFile: () => void
) {
  const base = sanitizeAiExportBasename(baseTitle);
  downloadUtf8TextFile(`${base}-ai-full.txt`, formatPStudyRowsAsTxt(itemsFull));
  window.setTimeout(() => {
    downloadUtf8TextFile(`${base}-ai-pstudy-capped.txt`, formatPStudyRowsAsTxt(itemsCapped));
    afterSecondFile();
  }, 350);
}

async function doImport(
  text: string,
  router: ReturnType<typeof useRouter>
): Promise<{ ok: boolean; error?: string }> {
  if (!text.trim()) {
    return { ok: false, error: "No content to import." };
  }
  const { items, wasExamFile } = parsePStudyTxt(text);
  if (items.length === 0) {
    return { ok: false, error: "No valid items found in the file." };
  }

  try {
    const title = wasExamFile ? "Imported exam deck" : "Imported deck";
    const newDeck = await createDeck(title);

    const itemsWithIds: PStudyItem[] = items.map((it) => ({
      ...it,
      id: crypto.randomUUID(),
    }));

    const deckWithItems: Deck = {
      ...newDeck,
      items: itemsWithIds,
    };

    await saveDeckWithItems(deckWithItems);
    router.push(`/deck/${newDeck.id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Import failed",
    };
  }
}

export default function ImportPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { toast: pushToast, success: toastSuccess, error: toastError } = useToast();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiDocument, setAiDocument] = useState("");
  const [aiOutput, setAiOutput] = useState<GenerateOutputMode>("both");
  const [aiFlashcardCount, setAiFlashcardCount] = useState(12);
  const [aiMcCount, setAiMcCount] = useState(10);
  const [aiMcWrongOptionCount, setAiMcWrongOptionCount] = useState<McWrongOptionCount>(4);
  const [aiDeckLanguage, setAiDeckLanguage] = useState<DeckGenerationLanguage>("auto");
  const [aiDeckTitle, setAiDeckTitle] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSourceEditorOpen, setAiSourceEditorOpen] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

  const showAiSourceEditor = aiSourceEditorOpen || !!aiDocument.trim();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  const handleImport = useCallback(
    async (text: string) => {
      setImporting(true);
      setMessage(null);
      const result = await doImport(text, router);
      if (!result.ok) {
        setMessage({ type: "err", text: result.error ?? "Import failed" });
      }
      setImporting(false);
    },
    [router]
  );

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        handleImport(String(reader.result ?? ""));
      };
      reader.readAsText(file, "UTF-8");
      e.target.value = "";
    },
    [handleImport]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (text) handleImport(text);
    },
    [handleImport]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.endsWith(".txt")) {
        setMessage({ type: "err", text: "Please drop a .txt file." });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        handleImport(String(reader.result ?? ""));
      };
      reader.readAsText(file, "UTF-8");
    },
    [handleImport]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleAiDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.toLowerCase().endsWith(".txt")) {
        toastError(t("import.aiDropTxtOnly"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAiDocument(String(reader.result ?? ""));
      };
      reader.readAsText(file, "UTF-8");
    },
    [toastError, t]
  );

  const handleAiSourcePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) setAiDocument(text);
  }, []);

  const handleAiFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAiDocument(String(reader.result ?? ""));
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }, []);

  const handleAiGenerate = useCallback(async () => {
    if (!aiDocument.trim()) {
      toastError(t("import.aiErrorGeneric"));
      return;
    }
    setAiBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/deck/generate-from-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: aiDocument,
          outputMode: aiOutput,
          flashcardCount: aiFlashcardCount,
          multipleChoiceCount: aiMcCount,
          mcWrongOptionCount: aiMcWrongOptionCount,
          deckLanguage: aiDeckLanguage,
          deckTitle: aiDeckTitle.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: Omit<PStudyItem, "id">[];
        itemsFull?: Omit<PStudyItem, "id">[];
        deckTitle?: string;
        meta?: { truncated?: boolean; extraItemsDropped?: number };
      };
      if (!res.ok) {
        if (res.status === 503) {
          toastError(t("import.aiErrorNotConfigured"));
        } else {
          toastError(data.error || t("import.aiErrorGeneric"));
        }
        setAiBusy(false);
        return;
      }
      const items = data.items ?? [];
      if (items.length === 0) {
        toastError(t("import.aiErrorGeneric"));
        setAiBusy(false);
        return;
      }
      const baseTitle = data.deckTitle ?? "Generated deck";
      const itemsFull = data.itemsFull;

      const withIds = (raw: Omit<PStudyItem, "id">[]): PStudyItem[] =>
        raw.map((it) => ({ ...it, id: crypto.randomUUID() }));

      const maybeDownloadFullAndCappedTxt = () => {
        if (!itemsFull?.length) return;
        downloadAiPstudyTxtPair(baseTitle, itemsFull, items, () =>
          pushToast(t("import.aiTxtExportsDownloaded"), "info")
        );
      };

      const notifyAiMeta = (meta?: { truncated?: boolean; extraItemsDropped?: number }) => {
        if (meta?.truncated) {
          pushToast(t("import.aiTruncatedNote"), "info");
        }
        const dropped = meta?.extraItemsDropped ?? 0;
        if (dropped > 0) {
          pushToast(t("import.aiExtraItemsDroppedNote", { count: dropped }), "info");
        }
      };

      if (aiOutput === "both") {
        const { flashcardItems, multipleChoiceItems } = splitGeneratedItemsByPracticeKind(items);
        if (flashcardItems.length > 0 && multipleChoiceItems.length > 0) {
          const fcDeck = await createDeck(`${baseTitle}${t("import.aiDeckSuffixFlashcards")}`);
          await saveDeckWithItems({ ...fcDeck, items: withIds(flashcardItems) });
          const mcDeck = await createDeck(`${baseTitle}${t("import.aiDeckSuffixMc")}`);
          await saveDeckWithItems({ ...mcDeck, items: withIds(multipleChoiceItems) });
          maybeDownloadFullAndCappedTxt();
          notifyAiMeta(data.meta);
          toastSuccess(t("import.aiSuccessTwoDecks"));
          router.push("/dashboard");
          return;
        }
        const singleSlice =
          flashcardItems.length > 0 ? flashcardItems : multipleChoiceItems;
        if (singleSlice.length === 0) {
          toastError(t("import.aiErrorGeneric"));
          setAiBusy(false);
          return;
        }
        const newDeck = await createDeck(baseTitle);
        await saveDeckWithItems({ ...newDeck, items: withIds(singleSlice) });
        maybeDownloadFullAndCappedTxt();
        notifyAiMeta(data.meta);
        toastSuccess(t("import.aiSuccess"));
        router.push(`/deck/${newDeck.id}`);
        return;
      }

      const newDeck = await createDeck(baseTitle);
      await saveDeckWithItems({ ...newDeck, items: withIds(items) });
      maybeDownloadFullAndCappedTxt();
      notifyAiMeta(data.meta);
      toastSuccess(t("import.aiSuccess"));
      router.push(`/deck/${newDeck.id}`);
    } catch {
      toastError(t("import.aiErrorGeneric"));
    } finally {
      setAiBusy(false);
    }
  }, [
    aiDocument,
    aiOutput,
    aiFlashcardCount,
    aiMcCount,
    aiMcWrongOptionCount,
    aiDeckLanguage,
    aiDeckTitle,
    router,
    pushToast,
    toastSuccess,
    toastError,
    t,
  ]);

  if (!ready) {
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
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Logo size="sm" withText />
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
            <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
              {t("dashboard.myDecks")}
            </Link>
            <Link href="/help" className="text-stone-600 hover:text-pstudy-primary">
              {t("help.nav")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-12 px-4 py-8">
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-2xl font-bold text-stone-900">{t("import.title")}</h1>
          <p className="mb-6 text-sm text-stone-600">
            {t("import.dropHint")} {t("import.pasteNote")}
          </p>

          <div
            role="button"
            tabIndex={0}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className={`${TXT_IMPORT_DROP_ZONE_CLASS} ${
              importing || aiBusy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            {importing ? (
              <p className="text-stone-600">{t("import.importing")}</p>
            ) : (
              <>
                <p className="mb-1 font-medium text-stone-700">{t("import.dropHint")}</p>
                <p className="text-sm text-stone-500">{t("import.pasteHint")}</p>
              </>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-2xl font-bold text-stone-900">{t("import.aiSectionTitle")}</h2>
          <p className="mb-6 text-sm text-stone-600">{t("import.aiSectionIntro")}</p>

          <input
            ref={aiFileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleAiFile}
          />

          {!showAiSourceEditor ? (
            <div
              role="button"
              tabIndex={0}
              onPaste={handleAiSourcePaste}
              onDrop={handleAiDrop}
              onDragOver={handleDragOver}
              onClick={() => !aiBusy && aiFileRef.current?.click()}
              className={`${TXT_IMPORT_DROP_ZONE_CLASS} ${
                aiBusy ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {aiBusy ? (
                <p className="text-stone-600">{t("import.aiGenerating")}</p>
              ) : (
                <>
                  <p className="mb-1 font-medium text-stone-700">{t("import.dropHint")}</p>
                  <p className="text-sm text-stone-500">{t("import.pasteHint")}</p>
                  <button
                    type="button"
                    className="mt-4 text-sm font-medium text-pstudy-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAiSourceEditorOpen(true);
                    }}
                  >
                    {t("import.aiOpenTextEditor")}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <div
                onDrop={handleAiDrop}
                onDragOver={handleDragOver}
                className={`rounded-lg border-2 border-dashed border-stone-300 bg-white transition focus-within:border-pstudy-primary focus-within:ring-2 focus-within:ring-pstudy-primary ${
                  aiBusy ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <label htmlFor="ai-doc" className="sr-only">
                  {t("import.aiDocumentLabel")}
                </label>
                <textarea
                  id="ai-doc"
                  value={aiDocument}
                  onChange={(e) => setAiDocument(e.target.value)}
                  rows={12}
                  placeholder={t("import.aiDocumentPlaceholder")}
                  disabled={aiBusy}
                  className="min-h-[12rem] w-full resize-y border-0 bg-transparent px-4 py-4 font-mono text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-0"
                />
              </div>
              {aiDocument.length > MAX_DOCUMENT_CHARS ? (
                <p
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
                  role="status"
                >
                  {t("import.aiDocumentOverLimit", {
                    usedChars: aiDocument.length.toLocaleString(),
                    maxChars: MAX_DOCUMENT_CHARS.toLocaleString(),
                  })}
                </p>
              ) : aiDocument.length > MAX_DOCUMENT_CHARS * 0.85 ? (
                <p className="text-xs text-amber-900/90" role="status">
                  {t("import.aiDocumentNearLimit", {
                    usedChars: aiDocument.length.toLocaleString(),
                    maxChars: MAX_DOCUMENT_CHARS.toLocaleString(),
                  })}
                </p>
              ) : aiDocument.trim() ? (
                <p className="text-xs text-stone-500">
                  {t("import.aiDocumentCharBudget", {
                    usedChars: aiDocument.length.toLocaleString(),
                    maxChars: MAX_DOCUMENT_CHARS.toLocaleString(),
                  })}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => aiFileRef.current?.click()}
                  className="rounded border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
                  disabled={aiBusy}
                >
                  {t("import.aiLoadTxt")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiDocument("");
                    setAiSourceEditorOpen(false);
                  }}
                  className="text-sm text-stone-600 underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
                  disabled={aiBusy}
                >
                  {t("import.aiClearSource")}
                </button>
              </div>
            </div>
          )}

          <fieldset className="mt-6 space-y-2">
            <legend className="text-sm font-medium text-stone-700">
              {t("import.aiOutputLabel")}
            </legend>
            {(
              [
                ["flashcards", t("import.aiOutputFlashcards")],
                ["multiple_choice", t("import.aiOutputMc")],
                ["both", t("import.aiOutputBoth")],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-stone-800">
                <input
                  type="radio"
                  name="ai-output"
                  value={value}
                  checked={aiOutput === value}
                  onChange={() => setAiOutput(value)}
                  className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                  disabled={aiBusy}
                />
                {label}
              </label>
            ))}
            {aiOutput === "both" ? (
              <p className="mt-2 text-xs text-stone-600">{t("import.aiBothCreatesTwoDecksNote")}</p>
            ) : null}
          </fieldset>

          <label className="mt-4 block text-sm font-medium text-stone-700" htmlFor="ai-deck-lang">
            {t("import.aiDeckLanguageLabel")}
          </label>
          <select
            id="ai-deck-lang"
            value={aiDeckLanguage}
            onChange={(e) => setAiDeckLanguage(e.target.value as DeckGenerationLanguage)}
            className="mt-1 max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
            disabled={aiBusy}
          >
            {DECK_GENERATION_LANGUAGE_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`import.aiDeckLang_${code}`)}
              </option>
            ))}
          </select>

          <div className="mt-6 flex flex-wrap gap-6">
            {(aiOutput === "flashcards" || aiOutput === "both") && (
              <label className="flex flex-col text-sm text-stone-700">
                <span>{t("import.aiFlashcardCount")}</span>
                <input
                  type="number"
                  min={4}
                  max={40}
                  value={aiFlashcardCount}
                  onChange={(e) => setAiFlashcardCount(Number(e.target.value) || 12)}
                  className="mt-1 w-24 rounded border border-stone-300 px-2 py-1"
                  disabled={aiBusy}
                />
              </label>
            )}
            {(aiOutput === "multiple_choice" || aiOutput === "both") && (
              <label className="flex flex-col text-sm text-stone-700">
                <span>{t("import.aiMcCount")}</span>
                <input
                  type="number"
                  min={4}
                  max={40}
                  value={aiMcCount}
                  onChange={(e) => setAiMcCount(Number(e.target.value) || 10)}
                  className="mt-1 w-24 rounded border border-stone-300 px-2 py-1"
                  disabled={aiBusy}
                />
              </label>
            )}
          </div>

          {(aiOutput === "multiple_choice" || aiOutput === "both") && (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium text-stone-700">
                {t("import.aiMcWrongOptionsLegend")}
              </legend>
              {(
                [
                  [3, t("import.aiMcWrongThree")] as const,
                  [4, t("import.aiMcWrongFour")] as const,
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-stone-800">
                  <input
                    type="radio"
                    name="ai-mc-wrong-count"
                    checked={aiMcWrongOptionCount === value}
                    onChange={() => setAiMcWrongOptionCount(value)}
                    className="border-stone-300 text-pstudy-primary focus:ring-pstudy-primary"
                    disabled={aiBusy}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}

          <label className="mt-6 block text-sm font-medium text-stone-700" htmlFor="ai-title">
            {t("import.aiDeckTitle")}
          </label>
          <input
            id="ai-title"
            type="text"
            value={aiDeckTitle}
            onChange={(e) => setAiDeckTitle(e.target.value)}
            placeholder={t("import.aiDeckTitlePlaceholder")}
            className="mt-1 w-full max-w-md rounded border border-stone-300 px-3 py-2 text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
            disabled={aiBusy}
          />

          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={aiBusy || !aiDocument.trim()}
            className="btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiBusy ? t("import.aiGenerating") : t("import.aiGenerate")}
          </button>
        </section>

        {message && (
          <p
            className={`${message.type === "ok" ? "text-green-700" : "text-red-600"} text-sm`}
            role="alert"
          >
            {message.text}
          </p>
        )}

        <p className="text-sm text-stone-500">
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            ← {t("result.backToDashboard")}
          </Link>
        </p>
      </main>
    </div>
  );
}
