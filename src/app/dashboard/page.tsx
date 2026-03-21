"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Deck } from "@/types/pstudy";
import { createClient } from "@/lib/supabase/client";
import {
  fetchDecks,
  createDeck,
  deleteDeck as deleteDeckDb,
} from "@/lib/supabase/decks";

export default function DashboardPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      try {
        const data = await fetchDecks();
        setDecks(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load decks");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleCreateDeck() {
    try {
      const newDeck = await createDeck("Untitled deck");
      setDecks((prev) => [newDeck, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create deck");
    }
  }

  async function handleDeleteDeck(id: string) {
    if (!confirm("Delete this deck?")) return;
    try {
      await deleteDeckDb(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete deck");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
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
          <nav className="flex items-center gap-4">
            <Link
              href="/community"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              Community
            </Link>
            <Link
              href="/import"
              className="text-stone-600 hover:text-pstudy-primary"
            >
              Import .txt
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-stone-900">My decks</h1>
          <button onClick={handleCreateDeck} className="btn-primary">
            New deck
          </button>
        </div>

        {error && (
          <p className="mb-4 text-red-600">{error}</p>
        )}

        {decks.length === 0 ? (
          <div className="card text-center text-stone-600">
            <p className="mb-4">No decks yet.</p>
            <p className="mb-4">
              Create a new deck or import an existing PSTUDY .txt file.
            </p>
            <div className="flex justify-center gap-4">
              <button onClick={handleCreateDeck} className="btn-primary">
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
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                        deck.isPublic
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      {deck.isPublic ? "Shared" : "Private"}
                    </span>
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
                    onClick={() => handleDeleteDeck(deck.id)}
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
