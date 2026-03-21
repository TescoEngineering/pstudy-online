"use client";

import { useEffect } from "react";

/**
 * Redirects to /auth/callback when Supabase sends token_hash and type (e.g. from password reset email).
 * Supabase may redirect to Site URL (root) instead of our redirectTo; this catches it.
 */
export function AuthRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/auth/callback") return;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash") ?? params.get("token");
    const type = params.get("type");
    if (tokenHash && (type === "recovery" || type === "email")) {
      window.location.replace(
        `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`
      );
    }
  }, []);
  return null;
}
