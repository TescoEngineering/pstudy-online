"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Handles Supabase auth callback (password reset, email confirmation).
 * Supabase passes tokens in the URL hash (#access_token=...&type=recovery) which
 * only the client can read. This page runs in the browser, processes the hash,
 * and redirects to the appropriate next step.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    async function handleCallback() {
      const supabase = createClient();
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const params = typeof window !== "undefined" ? window.location.search : "";
      const searchParams = new URLSearchParams(params);

      // Supabase passes tokens in the hash (implicit flow)
      if (hash && hash.includes("access_token")) {
        // Give the Supabase client a moment to parse the hash (it does this on init)
        await new Promise((r) => setTimeout(r, 100));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setStatus("success");
          router.replace("/login?recovery=1");
          return;
        }
      }

      // Fallback: token_hash in query (PKCE flow)
      const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token");
      const type = searchParams.get("type");
      if (tokenHash && (type === "recovery" || type === "email")) {
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
