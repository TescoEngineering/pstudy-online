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
              // Important: do not add horizontal padding/borders here. This component is used in a
              // "highlight layer" behind a transparent textarea, so layout-affecting styles would
              // desync glyph positions vs the textarea caret.
              className="rounded-sm bg-amber-200 text-stone-900 [box-decoration-break:clone]"
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
