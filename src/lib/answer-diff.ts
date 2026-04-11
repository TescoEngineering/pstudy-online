/**
 * Character-level alignment of what the user typed (`given`) against the expected string
 * for result review highlighting. Uses LCS backtracking: characters that belong to a longest
 * common subsequence are "ok"; others are mistakes (typos, wrong words, extra chars).
 *
 * {@link diffGivenVsExpectedWordAware} uses word alignment for speech (avoids punctuation stealing
 * character LCS). It only styles words in `given`; missing wording is not inlined — see the
 * expected-answer line in the UI.
 */

import { normalizeLenientAnswer } from "@/lib/exam-validation";

export type AnswerDiffSegment = { text: string; ok: boolean };

function lcsLengthTable(a: string, b: string): number[][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0)
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j]! = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j]! = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  return dp;
}

/**
 * Split `given` into segments: `ok` segments appear in order inside `expected` (LCS);
 * `ok: false` marks substitutions, insertions (relative to expected), etc.
 */
export function diffGivenVsExpected(given: string, expected: string): AnswerDiffSegment[] {
  if (!given) return [];

  const a = given;
  const b = expected ?? "";
  const n = a.length;
  const dp = lcsLengthTable(a, b);

  const markedOk = Array<boolean>(n).fill(false);
  let i = n;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      markedOk[i - 1] = true;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1]![j]! >= dp[i]![j - 1]!)) {
      i--;
    } else {
      j--;
    }
  }

  const out: AnswerDiffSegment[] = [];
  let k = 0;
  while (k < n) {
    const ok = markedOk[k] ?? false;
    let t = "";
    while (k < n && !!markedOk[k] === ok) {
      t += a[k]!;
      k++;
    }
    if (t.length > 0) out.push({ text: t, ok });
  }
  return out;
}

function wordEqToken(a: string, b: string): boolean {
  if (a === b) return true;
  const na = normalizeLenientAnswer(a);
  const nb = normalizeLenientAnswer(b);
  if (na.length > 0 && nb.length > 0 && na === nb) return true;
  /** Punctuation-only tokens can all normalize to empty — compare raw graphemes. */
  if (na === "" && nb === "") {
    return (
      a.normalize("NFKC").trim().toLowerCase() === b.normalize("NFKC").trim().toLowerCase()
    );
  }
  return false;
}

function lcsWordMatchIndices(gw: string[], ew: string[]): (number | null)[] {
  const n = gw.length;
  const m = ew.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (wordEqToken(gw[i - 1]!, ew[j - 1]!)) dp[i]![j]! = dp[i - 1]![j - 1]! + 1;
      else dp[i]![j]! = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const matchG: (number | null)[] = Array(n).fill(null);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      wordEqToken(gw[i - 1]!, ew[j - 1]!) &&
      dp[i]![j]! === dp[i - 1]![j - 1]! + 1
    ) {
      matchG[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1]![j]! >= dp[i]![j - 1]!)) {
      i--;
    } else {
      j--;
    }
  }
  return matchG;
}

/**
 * Word-level alignment for **your answer** review: user tokens marked ok/wrong. Missing expected
 * **words** are not spelled out — see “correct answer” below — but a red **gap** (NBSP run, capped)
 * hints at omitted phrases. We **suppress** that gap when:
 * - **Leading wrong block:** every user word *before* this match was unmatched (e.g. “Oui, d’accord.”
 *   replacing “Mais bien sûr!”) — no omission bar before the first aligned word (“Voilà…”).
 * - **Single-word substitution:** previous user word was wrong and exactly one expected word was
 *   skipped (one misspelling for one slot).
 * - **Multi-word substitution (mid-sentence):** two or more consecutive wrong user words immediately
 *   before the next matched word, and the skipped expected span is not much longer than that wrong
 *   run — omit the bar (e.g. “Lafontaine et” vs “La fontaine est” before “là-bas”).
 */
export function diffGivenVsExpectedWordAware(given: string, expected: string): AnswerDiffSegment[] {
  const ex = String(expected ?? "");
  const parts = given.match(/\S+|\s+/g) ?? [];
  const gw: string[] = [];
  for (const p of parts) {
    if (/\S/.test(p)) gw.push(p);
  }
  const ew = ex.trim().split(/\s+/).filter(Boolean);

  if (gw.length === 0) {
    return [];
  }

  const matchG = lcsWordMatchIndices(gw, ew);
  const segments: AnswerDiffSegment[] = [];
  let gi = 0;
  let ei = 0;
  let prevUserWordWasWrong = false;

  /** Count consecutive unmatched user words immediately before index `gi` (exclusive). */
  function consecutiveWrongWordsBefore(gi: number): number {
    let n = 0;
    for (let k = gi - 1; k >= 0 && matchG[k] === null; k--) n++;
    return n;
  }

  /** Omission indicator: width ~ missing character count (NBSP so the bar doesn’t collapse). */
  function pushGapsUntil(
    endExclusive: number,
    opts: {
      suppressSingleAfterWrong: boolean;
      suppressLeadingWrongBlock: boolean;
      wrongStreakBeforeMatch: number;
    }
  ) {
    if (endExclusive <= ei) return;
    const skipped = ew.slice(ei, endExclusive);
    const charCount = skipped.join(" ").length;
    ei = endExclusive;
    if (charCount === 0) return;
    if (opts.suppressLeadingWrongBlock && skipped.length >= 1) {
      return;
    }
    if (opts.suppressSingleAfterWrong && skipped.length === 1) {
      return;
    }
    const ws = opts.wrongStreakBeforeMatch;
    if (
      ws >= 2 &&
      skipped.length >= 1 &&
      skipped.length <= ws + 3
    ) {
      return;
    }
    const n = Math.max(2, Math.min(charCount, 64));
    const gap = "\u00A0".repeat(n);
    if (segments.length === 0) {
      segments.push({ text: gap, ok: false });
    } else {
      const last = segments[segments.length - 1]!;
      if (!last.ok) last.text += gap;
      else segments.push({ text: gap, ok: false });
    }
  }

  for (const part of parts) {
    if (!/\S/.test(part)) {
      if (segments.length) segments[segments.length - 1]!.text += part;
      continue;
    }
    const mj = matchG[gi];
    if (mj !== null) {
      const leadingAllWrongBeforeThis =
        gi > 0 && matchG.slice(0, gi).every((m) => m === null);
      pushGapsUntil(mj, {
        suppressSingleAfterWrong: prevUserWordWasWrong,
        suppressLeadingWrongBlock: leadingAllWrongBeforeThis,
        wrongStreakBeforeMatch: consecutiveWrongWordsBefore(gi),
      });
      segments.push({ text: part, ok: true });
      ei = mj + 1;
      prevUserWordWasWrong = false;
    } else {
      segments.push({ text: part, ok: false });
      prevUserWordWasWrong = true;
    }
    gi++;
  }
  pushGapsUntil(ew.length, {
    suppressSingleAfterWrong: false,
    suppressLeadingWrongBlock: false,
    wrongStreakBeforeMatch: 0,
  });

  return segments;
}
