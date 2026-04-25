/**
 * Remembers the user's last field of interest, topic, and content language
 * (from the deck editor) in localStorage. Successful .txt imports apply these
 * to the new deck so the detail view opens with the same setup.
 */

import { parseDeckContentLanguages, serializeDeckContentLanguages } from "@/lib/deck-content-language";
import { MAX_DECK_CLASSIFICATION_LEN } from "@/lib/deck-classification-validate";

const LS_FIELD = "pstudy-import-pref-field";
const LS_TOPIC = "pstudy-import-pref-topic";
const LS_CONTENT = "pstudy-import-pref-content-language";

function isStoredClassificationString(s: string, maxLen: number): boolean {
  const t = s.trim();
  return t.length > 0 && t.length <= maxLen;
}

export function readLastDeckClassificationPrefs(): {
  fieldOfInterest: string | null;
  topic: string | null;
  contentLanguage: string | null;
} {
  if (typeof window === "undefined") {
    return { fieldOfInterest: null, topic: null, contentLanguage: null };
  }
  let field: string | null = null;
  let topic: string | null = null;
  let contentLanguage: string | null = null;
  try {
    const rawField = localStorage.getItem(LS_FIELD)?.trim() ?? "";
    if (isStoredClassificationString(rawField, MAX_DECK_CLASSIFICATION_LEN)) {
      field = rawField;
    }
    const rawTopic = localStorage.getItem(LS_TOPIC)?.trim() ?? "";
    if (isStoredClassificationString(rawTopic, MAX_DECK_CLASSIFICATION_LEN)) {
      topic = rawTopic;
    }
    const rawContent = localStorage.getItem(LS_CONTENT);
    if (rawContent != null && rawContent.trim() !== "") {
      const codes = parseDeckContentLanguages(rawContent);
      contentLanguage = serializeDeckContentLanguages(codes);
    }
  } catch {
    /* ignore */
  }
  return { fieldOfInterest: field, topic, contentLanguage };
}

export function writeLastDeckClassificationPrefs(p: {
  fieldOfInterest: string | null;
  topic: string | null;
  contentLanguage: string | null;
}): void {
  if (typeof window === "undefined") return;
  try {
    const f = p.fieldOfInterest?.trim() ?? "";
    if (f) localStorage.setItem(LS_FIELD, f);
    else localStorage.removeItem(LS_FIELD);
    const top = p.topic?.trim() ?? "";
    if (top) localStorage.setItem(LS_TOPIC, top);
    else localStorage.removeItem(LS_TOPIC);
    if (p.contentLanguage != null && p.contentLanguage.trim() !== "") {
      localStorage.setItem(LS_CONTENT, p.contentLanguage.trim());
    } else {
      localStorage.removeItem(LS_CONTENT);
    }
  } catch {
    /* ignore */
  }
}
