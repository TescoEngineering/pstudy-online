"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { parsePStudyTxt } from "@/lib/txt-import";
import { Deck } from "@/types/pstudy";
import Link from "next/link";

const STORAGE_KEY = "pstudy-decks";

function loadDecks(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveDecks(decks: Deck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export default function ImportPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [enableDeobfuscation, setEnableDeobfuscation] = useState(false);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setText(String(reader.result ?? ""));
        setMessage(null);
      };
      reader.readAsText(file, "UTF-8");
    },
    []
  );

  const handleImport = useCallback(() => {
    if (!text.trim()) {
      setMessage({ type: "err", text: "Paste or upload a .txt file first." });
      return;
    }
    const { items, wasExamFile, errors } = parsePStudyTxt(text, {
      tryUnObfuscate: enableDeobfuscation,
    });
    if (items.length === 0) {
      setMessage({ type: "err", text: "No valid items found in the file." });
      return;
    }
    const decks = loadDecks();
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      title: wasExamFile ? "Imported exam deck" : "Imported deck",
      items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDecks([newDeck, ...decks]);
    const extra =
      errors.length > 0 ? ` (${errors[0]})` : "";
    setMessage({ type: "ok", text: `Imported ${items.length} items. Redirecting...${extra}` });
    setTimeout(() => router.push("/dashboard"), 1000);
  }, [text, router, enableDeobfuscation]);

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
          Paste the contents of a PSTUDY text file below, or upload one. We
          support plain and legacy files. If a legacy file contains Base64 pictures, we’ll convert them so you see thumbnails.
        </p>

        <div className="mb-4">
          <label className="btn-secondary inline-block cursor-pointer">
            <input
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFile}
            />
            Choose file
          </label>
        </div>

        <label className="mb-4 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={enableDeobfuscation}
            onChange={(e) => setEnableDeobfuscation(e.target.checked)}
          />
          Enable de-obfuscation (only for files saved with obfuscation)
        </label>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
          }}
          placeholder="Paste tab-separated lines: description, explanation, mc1, mc2, mc3, mc4, picture, instruction"
          className="mb-4 w-full rounded-lg border border-stone-300 p-3 font-mono text-sm focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          rows={12}
        />

        {message && (
          <p
            className={`mb-4 ${message.type === "ok" ? "text-green-700" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={handleImport} className="btn-primary">
            Import as new deck
          </button>
          <Link href="/dashboard" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </main>
    </div>
  );
}
