"use client";

import type { ReactNode } from "react";
import {
  parseFlashcardRevealSegments,
  splitKeywordTagsForHighlight,
  splitLineForKeywordCloze,
} from "@/lib/flashcard";

function ClozeInLine({
  text,
  keywordTags,
}: {
  text: string;
  keywordTags: readonly string[];
}) {
  const parts = splitLineForKeywordCloze(text, keywordTags);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) =>
        p.type === "text" ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span
            key={i}
            className="mx-0.5 inline-block min-w-[2ch] cursor-default border-b-2 border-dashed border-teal-700/55 px-0.5 align-baseline text-center font-medium text-teal-800/40"
            title={p.keyword}
            aria-label={`Gap (${p.keyword})`}
          >
            {"·".repeat(Math.min(10, Math.max(3, p.keyword.length)))}
          </span>
        )
      )}
    </span>
  );
}

type Props = {
  /** Full expected answer (same string grading uses). */
  answerText: string;
  /** Raw keywords field from the card (`Item.keywords`). */
  keywordsRaw: string;
  /** Section title (translated). */
  label: string;
};

/**
 * Shows the expected answer with only keyword-tagged substrings masked, so the learner
 * must supply the full sentence or bullet (including keywords) themselves.
 */
export function KeywordClozeAnswerPrompt({ answerText, keywordsRaw, label }: Props) {
  const tags = splitKeywordTagsForHighlight(keywordsRaw);
  const raw = String(answerText ?? "").trim();
  if (!tags.length || !raw) return null;

  const segs = parseFlashcardRevealSegments(raw);
  if (segs.length === 0) {
    return (
      <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 px-4 py-3 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-900/70">
          {label}
        </p>
        <p className="font-mono text-lg leading-relaxed text-stone-800">
          <ClozeInLine text={raw} keywordTags={tags} />
        </p>
      </div>
    );
  }

  const nodes: ReactNode[] = [];
  let bullets: string[] = [];
  let ulKey = 0;
  const flushBullets = () => {
    if (bullets.length === 0) return;
    nodes.push(
      <ul key={`ul-${ulKey++}`} className="list-disc space-y-2 pl-5">
        {bullets.map((b, i) => (
          <li key={i} className="font-mono text-lg leading-relaxed text-stone-800 marker:text-teal-700">
            <ClozeInLine text={b} keywordTags={tags} />
          </li>
        ))}
      </ul>
    );
    bullets = [];
  };
  for (let idx = 0; idx < segs.length; idx++) {
    const s = segs[idx];
    if (s.type === "bullet") bullets.push(s.text);
    else {
      flushBullets();
      nodes.push(
        <p key={`p-${idx}`} className="font-mono text-lg leading-relaxed text-stone-800">
          <ClozeInLine text={s.text} keywordTags={tags} />
        </p>
      );
    }
  }
  flushBullets();

  return (
    <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 px-4 py-3 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-900/70">
        {label}
      </p>
      <div className="space-y-2">{nodes}</div>
    </div>
  );
}
