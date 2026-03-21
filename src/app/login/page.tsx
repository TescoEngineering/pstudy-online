"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("");
        alert("Check your email to confirm your account, then log in.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-stone-900">
          {isSignUp ? "Create account" : "Log in"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-stone-600">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-stone-600">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Sign up" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-600">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-pstudy-primary hover:underline"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              No account yet?{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-pstudy-primary hover:underline"
              >
                Sign up
              </button>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-sm text-stone-500">
          <Link href="/" className="text-pstudy-primary hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
