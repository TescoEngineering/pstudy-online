"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
          router.replace("/login?recovery=1");
          return;
        }
      }

      // Implicit flow: tokens in hash (Supabase default for email links)
      if (hash && (hash.includes("access_token") || hash.includes("type=recovery"))) {
        const supabase = createImplicitClient();
        await new Promise((r) => setTimeout(r, 200));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Persist to our main client's storage (cookies) by refreshing
          const mainClient = createClient();
          await mainClient.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          setStatus("success");
          router.replace("/login?recovery=1");
          return;
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
          router.replace("/login?recovery=1");
          return;
        }
      }

      setStatus("error");
      router.replace("/login?error=auth");
    }

    handleCallback();
  }, [router]);

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
