"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { HelpNavLink } from "@/components/HelpNavLink";
import { parsePStudyTxt } from "@/lib/txt-import";
import type { GenerateOutputMode } from "@/lib/ai-deck-generate";
import { Deck, PStudyItem } from "@/types/pstudy";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createDeck, saveDeckWithItems } from "@/lib/supabase/decks";
import { useToast } from "@/components/Toast";

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
  const [aiDeckTitle, setAiDeckTitle] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);

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
          deckTitle: aiDeckTitle.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        items?: Omit<PStudyItem, "id">[];
        deckTitle?: string;
        meta?: { truncated?: boolean };
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
      const deckTitle = data.deckTitle ?? "Generated deck";
      const newDeck = await createDeck(deckTitle);
      const itemsWithIds: PStudyItem[] = items.map((it) => ({
        ...it,
        id: crypto.randomUUID(),
      }));
      await saveDeckWithItems({ ...newDeck, items: itemsWithIds });
      if (data.meta?.truncated) {
        pushToast(t("import.aiTruncatedNote"), "info");
      }
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
        <section>
          <h1 className="mb-2 text-2xl font-bold text-stone-900">{t("import.title")}</h1>
          <p className="mb-6 text-stone-600">
            {t("import.dropHint")} {t("import.pasteNote")}
          </p>

          <div
            role="button"
            tabIndex={0}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className={`flex min-h-[12rem] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white p-8 text-center transition hover:border-pstudy-primary hover:bg-teal-50/30 ${
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
          <h2 className="text-lg font-semibold text-stone-900">{t("import.aiSectionTitle")}</h2>
          <p className="mt-2 text-sm text-stone-600">{t("import.aiSectionIntro")}</p>

          <label className="mt-4 block text-sm font-medium text-stone-700" htmlFor="ai-doc">
            {t("import.aiDocumentLabel")}
          </label>
          <textarea
            id="ai-doc"
            value={aiDocument}
            onChange={(e) => setAiDocument(e.target.value)}
            rows={12}
            placeholder={t("import.aiDocumentPlaceholder")}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm text-stone-800 placeholder:text-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
            disabled={aiBusy}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={aiFileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleAiFile}
            />
            <button
              type="button"
              onClick={() => aiFileRef.current?.click()}
              className="rounded border border-stone-300 bg-stone-50 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              disabled={aiBusy}
            >
              {t("import.aiLoadTxt")}
            </button>
          </div>

          <fieldset className="mt-4 space-y-2">
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
          </fieldset>

          <div className="mt-4 flex flex-wrap gap-6">
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

          <label className="mt-4 block text-sm font-medium text-stone-700" htmlFor="ai-title">
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
