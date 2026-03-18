/**
 * PSTUDY desktop .txt format: tab-separated per line
 * description \t explanation \t mc1 \t mc2 \t mc3 \t mc4 \t picture \t instruction
 * First line "PSTUDYEXAMFILE" = exam file (we still import items after it, or skip).
 * Desktop may obfuscate strings with a simple reversible shuffle — we try to detect and reverse.
 */

import { PStudyItem } from "@/types/pstudy";

const EXAM_HEADER = "PSTUDYEXAMFILE";

function guessMimeFromBytes(bytes: Uint8Array): string | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";

  // GIF: "GIF87a" / "GIF89a"
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
    return "image/gif";

  // WEBP: "RIFF"...."WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";

  // BMP: "BM"
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";

  return null;
}

function sanitizeBase64(s: string): string {
  return s.replace(/\s+/g, "");
}

function tryDecodeLegacyPictureToDataUrl(raw: string): { url: string; wasBase64: boolean } {
  const s = raw.trim();
  if (!s) return { url: "", wasBase64: false };

  // Already a data URL
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(s)) return { url: s, wasBase64: true };

  // Probably a regular URL/path
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("blob:") || s.startsWith("file:"))
    return { url: s, wasBase64: false };

  // Heuristic: base64 is long-ish and only base64 characters (+ optional padding)
  const b64 = sanitizeBase64(s);
  const isMaybeBase64 = b64.length >= 80 && /^[A-Za-z0-9+/]+=*$/.test(b64);
  if (!isMaybeBase64) return { url: s, wasBase64: false };

  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const mime = guessMimeFromBytes(bytes);
    if (!mime) return { url: s, wasBase64: false };
    return { url: `data:${mime};base64,${b64}`, wasBase64: true };
  } catch {
    return { url: s, wasBase64: false };
  }
}

/** Reverses desktop stringObfuscate: alternating character unshuffle */
function unObfuscate(s: string): string {
  if (!s || s.length === 0) return s;
  const len = s.length;
  const remainder = len % 2;
  const middle = Math.floor(len / 2);
  let out = "";
  for (let i = middle + remainder; i >= 1; i--) {
    if (remainder === 0) {
      out += s[i + middle - 1] ?? "";
    }
    out += s[i - 1] ?? "";
    if (remainder === 1 && i !== 1) {
      out += s[i + middle - 1] ?? "";
    }
  }
  return out;
}

/** Heuristic: obfuscated text often has no spaces and looks scrambled */
function looksObfuscated(s: string): boolean {
  if (!s || s.length < 3) return false;
  const hasSpace = /\s/.test(s);
  const mostlyPrintable = /^[\x20-\x7E\u00A0-\u024F]+$/.test(s);
  return !hasSpace && mostlyPrintable && s.length > 2;
}

function parseLine(line: string, tryUnObfuscate: boolean): string[] {
  const parts = line.split("\t");
  const out = [...parts];
  while (out.length < 8) out.push("");
  if (tryUnObfuscate) {
    return out.map((p) => (looksObfuscated(p) ? unObfuscate(p) : p));
  }
  return out;
}

export interface ImportResult {
  items: PStudyItem[];
  wasExamFile: boolean;
  errors: string[];
}

export function parsePStudyTxt(
  text: string,
  options: { tryUnObfuscate?: boolean } = {}
): ImportResult {
  // IMPORTANT:
  // Some normal strings (e.g. "Texas") can look like obfuscated strings under heuristics.
  // So de-obfuscation is opt-in only.
  const tryUnObfuscate = options.tryUnObfuscate === true;
  const errors: string[] = [];
  const items: PStudyItem[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let wasExamFile = false;
  let index = 0;
  let base64PictureCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === EXAM_HEADER) {
      wasExamFile = true;
      continue;
    }
    const parts = parseLine(line, tryUnObfuscate);
    const [
      description,
      explanation,
      mc1,
      mc2,
      mc3,
      mc4,
      picture,
      instruction,
    ] = parts;
    if (!description && !explanation) continue;

    const pic = tryDecodeLegacyPictureToDataUrl(picture ?? "");
    if (pic.wasBase64) base64PictureCount++;

    items.push({
      id: `item-${index++}`,
      description: description ?? "",
      explanation: explanation ?? "",
      multiplechoice1: mc1 ?? "",
      multiplechoice2: mc2 ?? "",
      multiplechoice3: mc3 ?? "",
      multiplechoice4: mc4 ?? "",
      picture_url: pic.url ?? "",
      instruction: instruction ?? "",
    });
  }

  if (base64PictureCount > 0) {
    errors.push(
      `Detected ${base64PictureCount} legacy Base64 picture(s). They were converted to data URLs for local use. In the SaaS version we will upload them to cloud storage and store only the resulting HTTPS URL.`
    );
  }

  return { items, wasExamFile, errors };
}

export function generatePStudyTxt(items: PStudyItem[]): string {
  return items
    .map(
      (it) =>
        [
          it.description,
          it.explanation,
          it.multiplechoice1,
          it.multiplechoice2,
          it.multiplechoice3,
          it.multiplechoice4,
          it.picture_url,
          it.instruction,
        ].join("\t")
    )
    .join("\n");
}
