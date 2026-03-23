"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Handles Supabase auth callback (password reset, email confirmation).
 * Supabase email links use implicit flow (tokens in #hash). Our SSR client uses PKCE,
 * so we need an implicit-flow client here to process the hash.
 */
function createImplicitClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", detectSessionInUrl: true } }
  );
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    async function handleCallback() {
      const params = typeof window !== "undefined" ? window.location.search : "";
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const searchParams = new URLSearchParams(params);

      // PKCE flow: code in query
      const code = searchParams.get("code");
      if (code) {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && session) {
          setStatus("success");
          window.location.replace("/login?recovery=1");
          return;
        }
      }

      // Implicit flow: tokens in hash (Supabase default for email links)
      // Try implicit client first - it correctly parses Supabase's hash format
      if (hash && (hash.includes("access_token") || hash.includes("type=recovery"))) {
        const implicitSupabase = createImplicitClient();
        let session = (await implicitSupabase.auth.getSession()).data.session;
        for (let i = 0; i < 10 && !session; i++) {
          await new Promise((r) => setTimeout(r, 100));
          session = (await implicitSupabase.auth.getSession()).data.session;
        }
        if (session) {
          const mainClient = createClient();
          const { error } = await mainClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          if (!error) {
            setStatus("success");
            window.location.replace("/login?recovery=1");
            return;
          }
        }
        // Fallback: manual hash parse (in case implicit client cleared hash before storing)
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          try {
            const mainClient = createClient();
            const { error } = await mainClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error) {
              setStatus("success");
              window.location.replace("/login?recovery=1");
              return;
            }
          } catch {
            // Fall through to error
          }
        }
      }

      // token_hash in query (custom email template)
      const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type");
      if (tokenHash && (type === "recovery" || type === "email")) {
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({
          type: type as "recovery" | "email",
          token_hash: tokenHash,
        });
        if (!error) {
          setStatus("success");
          window.location.replace("/login?recovery=1");
          return;
        }
      }

      setStatus("error");
      window.location.replace("/login?error=auth");
    }

    handleCallback();
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
