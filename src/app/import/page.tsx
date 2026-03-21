"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { parsePStudyTxt } from "@/lib/txt-import";
import { Deck, PStudyItem } from "@/types/pstudy";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createDeck, saveDeckWithItems } from "@/lib/supabase/decks";

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
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-pstudy-primary">
            PSTUDY
          </Link>
          <Link href="/dashboard" className="text-stone-600 hover:text-pstudy-primary">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-stone-900">
          Import PSTUDY .txt file
        </h1>
        <p className="mb-6 text-stone-600">
          Drop your file here, or click to browse. You can also click the box and paste (Ctrl+V).
        </p>

        <div
          role="button"
          tabIndex={0}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className={`flex min-h-[12rem] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white p-8 text-center transition hover:border-pstudy-primary hover:bg-teal-50/30 ${
            importing ? "pointer-events-none opacity-60" : ""
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
            <p className="text-stone-600">Importing...</p>
          ) : (
            <>
              <p className="mb-1 font-medium text-stone-700">
                Drop .txt file or click to browse
              </p>
              <p className="text-sm text-stone-500">
                Or click here and paste (Ctrl+V)
              </p>
            </>
          )}
        </div>

        {message && (
          <p
            className={`mt-4 ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}

        <p className="mt-6 text-sm text-stone-500">
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            ← Back to dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
