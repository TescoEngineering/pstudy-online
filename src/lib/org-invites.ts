import type { NextRequest } from "next/server";
import { getPublicAppUrl } from "@/lib/deck-review";

export function generateOrgInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeOrgInviteEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e || !EMAIL_RE.test(e)) return null;
  return e;
}

export const ORG_INVITE_EXPIRY_DAYS = 14;

export function orgInviteExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + ORG_INVITE_EXPIRY_DAYS);
  return d.toISOString();
}

export function getOrgInviteAcceptUrl(request: NextRequest, token: string): string {
  return `${getPublicAppUrl(request)}/invite/org/${token}`;
}
