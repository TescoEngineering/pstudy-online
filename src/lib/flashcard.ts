/**
 * Flashcard mode: skeleton of explanation, fill in by speaking matching words.
 */

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, "");
}

/** Split explanation into words (preserve punctuation, flatten lines) */
export function getExplanationWords(explanation: string): string[] {
  return String(explanation ?? "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Build display string from words and filled slots */
export function buildFlashcardDisplay(
  words: string[],
  filled: (string | null)[]
): string {
  return words
    .map((w, i) => (filled[i] !== null ? filled[i] : "_".repeat(w.length)))
    .join(" ");
}

/** Match transcript words to explanation and update filled slots. Returns new filled array. */
export function fillFromTranscript(
  transcript: string,
  words: string[],
  filled: (string | null)[]
): (string | null)[] {
  const normalizedWords = words.map((w) => normalize(w));
  const transcriptWords = transcript
    .split(/\s+/)
    .map((w) => normalize(w))
    .filter(Boolean);
  const next = [...filled];

  for (const tw of transcriptWords) {
    if (!tw) continue;
    for (let i = 0; i < words.length; i++) {
      if (next[i] !== null) continue;
      if (normalizedWords[i] === tw) {
        next[i] = words[i];
        break;
      }
    }
  }
  return next;
}

/** Check if all slots are filled */
export function isComplete(filled: (string | null)[]): boolean {
  return filled.every((f) => f !== null);
}
