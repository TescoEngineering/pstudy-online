/**
 * Per-browser lists of custom field and topic values the user has saved, so they
 * reappear in the deck editor dropdowns alongside built-in options.
 */

import { MAX_DECK_CLASSIFICATION_LEN } from "@/lib/deck-classification-validate";

const LS_FIELDS = "pstudy-user-classification-custom-fields";
const LS_TOPICS = "pstudy-user-classification-custom-topics";

export const DECK_CLASSIFICATION_SELECT_CUSTOM_FIELD = "__pstudy_custom_field__";
export const DECK_CLASSIFICATION_SELECT_CUSTOM_TOPIC = "__pstudy_custom_topic__";

function safeParseFields(raw: string | null): string[] {
  if (raw == null) return [];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .filter((x) => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= MAX_DECK_CLASSIFICATION_LEN);
  } catch {
    return [];
  }
}

function safeParseTopics(raw: string | null): Record<string, string[]> {
  if (raw == null) return {};
  try {
    const p = JSON.parse(raw) as unknown;
    if (p == null || typeof p !== "object" || Array.isArray(p)) return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      const key = k.trim();
      if (!key || key.length > MAX_DECK_CLASSIFICATION_LEN) continue;
      if (!Array.isArray(v)) continue;
      out[key] = v
        .filter((x) => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= MAX_DECK_CLASSIFICATION_LEN);
    }
    return out;
  } catch {
    return {};
  }
}

export function loadUserCustomFields(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return safeParseFields(localStorage.getItem(LS_FIELDS));
  } catch {
    return [];
  }
}

export function loadUserCustomTopicsMap(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    return safeParseTopics(localStorage.getItem(LS_TOPICS));
  } catch {
    return {};
  }
}

function saveUserCustomFields(list: string[]) {
  if (typeof window === "undefined") return;
  try {
    const uniq = Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
    uniq.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    localStorage.setItem(LS_FIELDS, JSON.stringify(uniq));
  } catch {
    /* ignore */
  }
}

function saveUserCustomTopicsMap(m: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_TOPICS, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function addUserCustomFieldIfNew(value: string) {
  const t = value.trim();
  if (!t || t.length > MAX_DECK_CLASSIFICATION_LEN) return;
  const cur = loadUserCustomFields();
  if (cur.some((c) => c === t)) return;
  saveUserCustomFields([...cur, t]);
}

export function addUserCustomTopicForFieldIfNew(field: string, topic: string) {
  const f = field.trim();
  const top = topic.trim();
  if (!f || !top) return;
  if (f.length > MAX_DECK_CLASSIFICATION_LEN || top.length > MAX_DECK_CLASSIFICATION_LEN) return;
  const map = loadUserCustomTopicsMap();
  const existing = new Set(map[f] ?? []);
  if (existing.has(top)) return;
  const next = { ...map, [f]: [...existing, top] };
  next[f] = Array.from(new Set(next[f])).sort((a, b) =>
    a.localeCompare(b, "en", { sensitivity: "base" })
  );
  saveUserCustomTopicsMap(next);
}

export function removeUserCustomFieldFromList(value: string): void {
  const t = value.trim();
  if (!t) return;
  const cur = loadUserCustomFields();
  const next = cur.filter((c) => c !== t);
  if (next.length === cur.length) return;
  saveUserCustomFields(next);
  const map = loadUserCustomTopicsMap();
  if (map[t] != null) {
    const nextMap = { ...map };
    delete nextMap[t];
    saveUserCustomTopicsMap(nextMap);
  }
}

export function removeUserCustomTopicFromList(field: string, topic: string): void {
  const f = field.trim();
  const top = topic.trim();
  if (!f || !top) return;
  const map = loadUserCustomTopicsMap();
  const arr = map[f] ?? [];
  const nextArr = arr.filter((x) => x !== top);
  if (nextArr.length === arr.length) return;
  const nextMap: Record<string, string[]> = { ...map };
  if (nextArr.length === 0) {
    delete nextMap[f];
  } else {
    nextMap[f] = nextArr;
  }
  saveUserCustomTopicsMap(nextMap);
}
