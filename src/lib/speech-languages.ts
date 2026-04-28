/**
 * Languages supported by the Web Speech API (TTS and speech recognition).
 * Uses BCP-47 tags. Availability depends on browser/OS.
 */
export const SPEECH_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es", name: "Spanish" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "fr", name: "French" },
  { code: "fr-FR", name: "French (France)" },
  { code: "de", name: "German" },
  { code: "de-DE", name: "German (Germany)" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "zh-CN", name: "Chinese (Mandarin)" },
  { code: "zh-TW", name: "Chinese (Taiwan)" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turkish" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "el", name: "Greek" },
] as const;

/**
 * Resolves a stored deck/practice value to a `value` that matches
 * `<option value={...}>` from this list (case-insensitive; `other` is supported but not in {@link SPEECH_LANGUAGES}).
 * Returns `""` if there is no match (use empty selection in a controlled select).
 */
export function matchSpeechLanguageSelectValue(
  stored: string | null | undefined
): string {
  if (stored == null) return "";
  const s = String(stored).trim();
  if (s === "") return "";
  if (s === "other") return "other";
  if (SPEECH_LANGUAGES.some((l) => l.code === s)) return s;
  const low = s.toLowerCase();
  const hit = SPEECH_LANGUAGES.find((l) => l.code.toLowerCase() === low);
  return hit ? hit.code : "";
}
