"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Handles Supabase auth callback (password reset, email confirmation).
 * Supabase email links may use: query token_hash + type (most reliable), PKCE ?code=,
 * or implicit flow (tokens in #hash). Hash fragments are often stripped by in-app email
 * browsers — prefer the custom reset template with token_hash in the query (see Supabase docs).
 */
function createImplicitClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", detectSessionInUrl: true } }
  );
}

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return new URLSearchParams(raw);
  } catch {
    try {
      return new URLSearchParams(decodeURIComponent(raw));
    } catch {
      return new URLSearchParams();
    }
  }
}

/** True if the URL fragment likely contains Supabase auth tokens (including URL-encoded). */
function fragmentLooksLikeAuthCallback(hash: string): boolean {
  if (!hash) return false;
  const h = hash.toLowerCase();
  return (
    h.includes("access_token") ||
    h.includes("refresh_token") ||
    h.includes("type=recovery") ||
    h.includes("type%3drecovery")
  );
}

async function trySetSessionFromTokens(accessToken: string, refreshToken: string): Promise<boolean> {
  const mainClient = createClient();
  const { error } = await mainClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return !error;
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const params = typeof window !== "undefined" ? window.location.search : "";
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const searchParams = new URLSearchParams(params);

      // 1) token_hash in query (custom reset-password template) — works without #hash; best for email clients
      const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
      const otpType = searchParams.get("type");
      if (tokenHash && (otpType === "recovery" || otpType === "email")) {
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({
          type: otpType as "recovery" | "email",
          token_hash: tokenHash,
        });
        if (!cancelled && !error) {
          setStatus("success");
          window.location.replace("/login?recovery=1");
          return;
        }
      }

      // 2) PKCE: ?code= — can fail if the link is opened in another browser (no code_verifier cookie)
      const code = searchParams.get("code");
      if (code) {
        const supabase = createClient();
        const {
          data: { session },
          error,
        } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !error && session) {
          setStatus("success");
          window.location.replace("/login?recovery=1");
          return;
        }
      }

      // 3) Implicit flow: tokens in #hash — parse tokens manually first (before implicit client touches the URL)
      if (hash && fragmentLooksLikeAuthCallback(hash)) {
        const hashParams = parseHashParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const ok = await trySetSessionFromTokens(accessToken, refreshToken);
          if (!cancelled && ok) {
            setStatus("success");
            window.location.replace("/login?recovery=1");
            return;
          }
        }

        const implicitSupabase = createImplicitClient();
        let session = (await implicitSupabase.auth.getSession()).data.session;
        for (let i = 0; i < 15 && !session; i++) {
          await new Promise((r) => setTimeout(r, 100));
          session = (await implicitSupabase.auth.getSession()).data.session;
        }
        if (session) {
          const mainClient = createClient();
          const { error } = await mainClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          if (!cancelled && !error) {
            setStatus("success");
            window.location.replace("/login?recovery=1");
            return;
          }
        }

        const retryParams = parseHashParams(hash);
        const at = retryParams.get("access_token");
        const rt = retryParams.get("refresh_token");
        if (at && rt) {
          const ok = await trySetSessionFromTokens(at, rt);
          if (!cancelled && ok) {
            setStatus("success");
            window.location.replace("/login?recovery=1");
            return;
          }
        }
      }

      if (!cancelled) {
        setStatus("error");
        window.location.replace("/login?error=auth");
      }
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <p className="text-stone-600">
        {status === "loading" && "Setting up your session…"}
        {status === "success" && "Redirecting…"}
        {status === "error" && "Something went wrong. Redirecting to login…"}
      </p>
    </div>
  );
}
