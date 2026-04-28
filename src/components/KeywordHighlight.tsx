"use client";

import { keywordTagsEligibleForHighlight } from "@/lib/flashcard";

/** Highlights keyword phrases (case-insensitive) inside free text. */

export function KeywordHighlight({
  text,
  keywords,
}: {
  text: string;
  keywords: readonly string[];
}) {
  const terms = keywordTagsEligibleForHighlight(keywords);
  if (!text) return null;
  if (!terms.length) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }

  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const isKw = sorted.some((k) => part.toLowerCase() === k.toLowerCase());
        if (isKw) {
          return (
            <mark
              key={i}
              className="rounded-sm bg-amber-200 px-0.5 text-stone-900"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
