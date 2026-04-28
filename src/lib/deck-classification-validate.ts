/**
 * Field / topic classification: length, preset checks, and which pieces need moderation.
 * Safe for client and server.
 */

import { FIELDS_OF_INTEREST, getTopicsForField, type FieldOfInterest } from "@/lib/deck-attributes";

export const MAX_DECK_CLASSIFICATION_LEN = 120;

export function isPresetFieldOfInterest(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return (FIELDS_OF_INTEREST as readonly string[]).includes(t);
}

/** Topic counts as a preset for this field if it appears in the suggested list for that field. */
export function isPresetTopicForField(
  field: string | null | undefined,
  topic: string
): boolean {
  const top = topic.trim();
  if (!top) return true;
  const f = field?.trim() ?? "";
  return getTopicsForField(f || null).includes(top);
}

/**
 * Free-text values that are not in the built-in lists are sent to the moderation API.
 * Empty strings are not moderated.
 */
export function getClassificationStringsToModerate(
  field: string | null,
  topic: string | null
): string[] {
  const out: string[] = [];
  const f = field?.trim() ?? "";
  const top = topic?.trim() ?? "";
  if (f && !isPresetFieldOfInterest(f)) out.push(f);
  if (top && !isPresetTopicForField(f || null, top)) out.push(top);
  return out;
}

export function normalizeClassificationValue(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (s.length > MAX_DECK_CLASSIFICATION_LEN) {
    return s.slice(0, MAX_DECK_CLASSIFICATION_LEN);
  }
  return s;
}

export function isClassificationValueLengthValid(raw: string | null | undefined): boolean {
  if (raw == null || raw === "") return true;
  return String(raw).trim().length <= MAX_DECK_CLASSIFICATION_LEN;
}
