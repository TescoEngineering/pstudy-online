"use client";

/**
 * Flashcard practice: highlight keyword tags inside text.
 * - Official side: green if the same keyword also appears in the user's answer; red if not.
 * - User side: green if the keyword also appears in the official answer; otherwise plain (no highlight).
 */

export function FlashcardKeywordHighlight({
  text,
  keywordTags,
  compareText,
  side,
}: {
  text: string;
  keywordTags: readonly string[];
  compareText: string;
  side: "official" | "user";
}) {
  const terms = keywordTags.map((k) => k.trim()).filter(Boolean);
  if (!text) return null;
  if (!terms.length) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }

  const compareLower = String(compareText ?? "").toLowerCase();
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const kw = sorted.find((k) => part.toLowerCase() === k.toLowerCase());
        if (!kw) return <span key={i}>{part}</span>;

        if (side === "official") {
          const userHasIt = compareLower.includes(kw.toLowerCase());
          return (
            <mark
              key={i}
              className={
                userHasIt
                  ? "rounded-sm bg-emerald-200 px-0.5 font-medium text-emerald-950"
                  : "rounded-sm bg-red-200 px-0.5 font-medium text-red-950"
              }
            >
              {part}
            </mark>
          );
        }

        const officialHasIt = compareLower.includes(kw.toLowerCase());
        if (officialHasIt) {
          return (
            <mark
              key={i}
              className="rounded-sm bg-emerald-200 px-0.5 font-medium text-emerald-950"
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
