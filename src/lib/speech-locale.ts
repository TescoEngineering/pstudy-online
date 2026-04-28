/**
 * Normalize UI / short speech language codes to full BCP-47 tags for
 * Web Speech (TTS + recognition) and Google Cloud Speech-to-Text.
 */

const TWO_LETTER_TO_BCP47: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-BR",
  nl: "nl-NL",
  pl: "pl-PL",
  ru: "ru-RU",
  ja: "ja-JP",
  zh: "zh-CN",
  ko: "ko-KR",
  ar: "ar-SA",
  hi: "hi-IN",
  tr: "tr-TR",
  sv: "sv-SE",
  da: "da-DK",
  fi: "fi-FI",
  el: "el-GR",
};

/**
 * e.g. "en" → "en-US", "nl" → "nl-NL", "en-GB" → "en-GB", "zh-CN" → "zh-CN"
 */
export function normalizeSpeechLocale(code: string): string {
  const raw = code.trim();
  if (!raw) return "en-US";
  if (raw.includes("-")) {
    const i = raw.indexOf("-");
    const lang = raw.slice(0, i).toLowerCase();
    let region = raw.slice(i + 1);
    if (region.length === 2) region = region.toUpperCase();
    return `${lang}-${region}`;
  }
  const key = raw.toLowerCase();
  return TWO_LETTER_TO_BCP47[key] ?? `${key}-${key.toUpperCase()}`;
}
