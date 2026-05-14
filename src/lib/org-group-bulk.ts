import { normalizeOrgInviteEmail } from "@/lib/org-invites";

/** Split pasted blob into candidate tokens (newlines, commas, tabs). */
export function splitEmailPaste(raw: string): string[] {
  const parts = raw
    .split(/[\n\r,;\t]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

export type ParsedEmailPaste = {
  validEmails: string[];
  invalidLineCount: number;
};

export function parseEmailPaste(raw: string): ParsedEmailPaste {
  const tokens = splitEmailPaste(raw);
  const validEmails: string[] = [];
  let invalidLineCount = 0;
  const seen = new Set<string>();
  for (const t of tokens) {
    const n = normalizeOrgInviteEmail(t);
    if (!n) {
      invalidLineCount++;
      continue;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    validEmails.push(n);
  }
  return { validEmails, invalidLineCount };
}
