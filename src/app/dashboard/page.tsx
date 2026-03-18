"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Deck } from "@/types/pstudy";

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
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export default function DashboardPage() {
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    setDecks(loadDecks());
  }, []);

  function createNewDeck() {
    const newDeck: Deck = {
      id: `deck-${Date.now()}`,
      title: "Untitled deck",
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [newDeck, ...decks];
    setDecks(next);
    saveDecks(next);
  }

  function deleteDeck(id: string) {
    if (!confirm("Delete this deck?")) return;
    const next = decks.filter((d) => d.id !== id);
    setDecks(next);
    saveDecks(next);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-pstudy-primary">
            PSTUDY
          </Link>
          <nav className="flex gap-4">
            <Link href="/import" className="text-stone-600 hover:text-pstudy-primary">
              Import .txt
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-stone-900">My decks</h1>
          <button onClick={createNewDeck} className="btn-primary">
            New deck
          </button>
        </div>

        {decks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">No decks yet.</p>
            <p className="mb-4">
              Create a new deck or import an existing PSTUDY .txt file.
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={createNewDeck} className="btn-primary">
                New deck
              </button>
              <Link href="/import" className="btn-secondary">
                Import .txt
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="card flex items-center justify-between"
              >
                <div>
                  <Link
                    href={`/deck/${deck.id}`}
                    className="font-semibold text-pstudy-primary hover:underline"
                  >
                    {deck.title}
                  </Link>
                  <p className="text-sm text-stone-500">
                    {deck.items.length} item{deck.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/practice/${deck.id}`}
                    className="btn-secondary text-sm"
                  >
                    Practice
                  </Link>
                  <button
                    onClick={() => deleteDeck(deck.id)}
                    className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
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
