"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Deck, PStudyItem } from "@/types/pstudy";

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

export default function DeckEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    const decks = loadDecks();
    const d = decks.find((x) => x.id === id) ?? null;
    setDeck(d);
    if (d) setTitle(d.title);
  }, [id]);

  function updateDeck(updates: Partial<Deck>) {
    if (!deck) return;
    const next = { ...deck, ...updates, updatedAt: new Date().toISOString() };
    setDeck(next);
    const decks = loadDecks().map((d) => (d.id === id ? next : d));
    saveDecks(decks);
  }

  function updateTitle(newTitle: string) {
    setTitle(newTitle);
    updateDeck({ title: newTitle });
  }

  function updateItem(index: number, item: PStudyItem) {
    if (!deck) return;
    const items = [...deck.items];
    items[index] = item;
    updateDeck({ items });
  }

  function addItem() {
    if (!deck) return;
    const newItem: PStudyItem = {
      id: `item-${Date.now()}`,
      description: "",
      explanation: "",
      multiplechoice1: "",
      multiplechoice2: "",
      multiplechoice3: "",
      multiplechoice4: "",
      picture_url: "",
      instruction: "",
    };
    updateDeck({ items: [...deck.items, newItem] });
  }

  function removeItem(index: number) {
    if (!deck || !confirm("Remove this item?")) return;
    const items = deck.items.filter((_, i) => i !== index);
    updateDeck({ items });
  }

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-stone-600">Deck not found.</p>
        <Link href="/dashboard" className="ml-2 text-pstudy-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-pstudy-primary hover:underline">
            ← Dashboard
          </Link>
          <input
            type="text"
            value={title}
            onChange={(e) => updateTitle(e.target.value)}
            className="rounded border border-stone-300 px-3 py-1 text-lg font-semibold focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
          />
          <Link href={`/practice/${id}`} className="btn-primary">
            Practice
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex justify-between">
          <span className="text-stone-600">{deck.items.length} items</span>
          <button onClick={addItem} className="btn-primary text-sm">
            Add item
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-lg border border-stone-200 bg-white text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="p-2 font-medium">#</th>
                <th className="p-2 font-medium">Description (question)</th>
                <th className="p-2 font-medium">Explanation (answer)</th>
                <th className="p-2 font-medium">MC 1–4</th>
                <th className="p-2 font-medium">Instruction</th>
                <th className="p-2 font-medium">Picture URL</th>
                <th className="p-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {deck.items.map((item, i) => (
                <tr key={item.id} className="border-b border-stone-100">
                  <td className="p-2 text-stone-500">{i + 1}</td>
                  <td className="p-2">
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(i, { ...item, description: e.target.value })
                      }
                      className="w-full rounded border border-stone-200 px-2 py-1 focus:border-pstudy-primary focus:outline-none"
                      placeholder="Question"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      value={item.explanation}
                      onChange={(e) =>
                        updateItem(i, { ...item, explanation: e.target.value })
                      }
                      className="w-full rounded border border-stone-200 px-2 py-1 focus:border-pstudy-primary focus:outline-none"
                      placeholder="Answer"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      {[1, 2, 3, 4].map((n) => (
                        <input
                          key={n}
                          value={
                            item[
                              `multiplechoice${n}` as keyof PStudyItem
                            ] as string
                          }
                          onChange={(e) =>
                            updateItem(i, {
                              ...item,
                              [`multiplechoice${n}`]: e.target.value,
                            })
                          }
                          className="rounded border border-stone-200 px-2 py-0.5 text-xs focus:border-pstudy-primary focus:outline-none"
                          placeholder={`MC ${n}`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="p-2">
                    <input
                      value={item.instruction}
                      onChange={(e) =>
                        updateItem(i, { ...item, instruction: e.target.value })
                      }
                      className="w-full rounded border border-stone-200 px-2 py-1 focus:border-pstudy-primary focus:outline-none"
                      placeholder="Instruction"
                    />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={item.picture_url}
                        onChange={(e) =>
                          updateItem(i, { ...item, picture_url: e.target.value })
                        }
                        className="w-full rounded border border-stone-200 px-2 py-1 text-xs focus:border-pstudy-primary focus:outline-none"
                        placeholder="https://..."
                      />
                      {item.picture_url && (
                        <img
                          src={item.picture_url}
                          alt="Preview"
                          className="h-8 w-8 rounded object-cover ring-1 ring-stone-200"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    <button
                      onClick={() => removeItem(i)}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
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
