"use client";

import { useEffect } from "react";

/**
 * Redirects to /auth/callback when Supabase sends auth tokens (e.g. from password reset email).
 * Supabase may redirect to Site URL (root) instead of our redirectTo; this catches it.
 * Tokens can be in query params (?token_hash=...) or hash (#access_token=...&type=recovery).
 */
export function AuthRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/auth/callback") return;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash") ?? params.get("token");
    const type = params.get("type");
    const hash = window.location.hash || "";
    const h = hash.toLowerCase();
    const hasHashTokens =
      h.includes("access_token") ||
      h.includes("refresh_token") ||
      h.includes("type=recovery") ||
      h.includes("type%3drecovery");
    if (tokenHash && (type === "recovery" || type === "email")) {
      window.location.replace(
        `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`
      );
    } else if (hasHashTokens) {
      window.location.replace(`/auth/callback${hash}`);
    }
  }, []);
  return null;
}
