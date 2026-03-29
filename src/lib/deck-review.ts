import type { NextRequest } from "next/server";
import type { PStudyItem } from "@/types/pstudy";

export function generateReviewAccessToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getPublicAppUrl(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeReviewerEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e || !EMAIL_RE.test(e)) return null;
  return e;
}

/** Ensure payload items match DB ids exactly (same set, same count); fill order by payload order. */
export function validateReviewerItemPayload(
  dbIdsOrdered: string[],
  payload: PStudyItem[]
): { ok: true } | { ok: false; error: string } {
  if (payload.length !== dbIdsOrdered.length) {
    return { ok: false, error: "Item count must not change during review." };
  }
  const setDb = new Set(dbIdsOrdered);
  const setPay = new Set(payload.map((p) => p.id));
  if (setDb.size !== setPay.size) {
    return { ok: false, error: "Item ids must match the deck." };
  }
  for (const id of setDb) {
    if (!setPay.has(id)) return { ok: false, error: "Item ids must match the deck." };
  }
  return { ok: true };
}

export type DeckReviewInviteRow = {
  id: string;
  deck_id: string;
  owner_id: string;
  reviewer_email: string;
  access_token: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  reviewer_user_id: string | null;
};
