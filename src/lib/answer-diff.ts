/**
 * Character-level alignment of what the user typed (`given`) against the expected string
 * for result review highlighting. Uses LCS backtracking: characters that belong to a longest
 * common subsequence are "ok"; others are mistakes (typos, wrong words, extra chars).
 */

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
