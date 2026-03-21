"use client";

import { useState, useEffect } from "react";
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
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    const params = typeof window !== "undefined" ? window.location.search : "";
    if (params.includes("recovery=1")) {
      setRecoveryMode(true);
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      if (forgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setResetSent(true);
      } else if (recoveryMode) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecoveryMode(false);
        alert("Password updated. You can now log in.");
        window.history.replaceState(null, "", "/login");
        router.refresh();
      } else if (isSignUp) {
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

  if (recoveryMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-sm">
          <h1 className="mb-6 text-xl font-bold text-stone-900">Set new password</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm text-stone-600">
                New password
              </label>
              <input
                id="new-password"
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
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-sm">
          <h1 className="mb-4 text-xl font-bold text-stone-900">Check your email</h1>
          <p className="mb-6 text-stone-600">
            We sent a password reset link to <strong>{email}</strong>. Click the link in the
            email to set a new password.
          </p>
          <button
            type="button"
            onClick={() => {
              setResetSent(false);
              setForgotPassword(false);
            }}
            className="btn-primary w-full"
          >
            Back to log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-stone-900">
          {forgotPassword ? "Reset password" : isSignUp ? "Create account" : "Log in"}
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
          {!forgotPassword && (
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
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : forgotPassword
                ? "Send reset link"
                : isSignUp
                  ? "Sign up"
                  : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-600">
          {forgotPassword ? (
            <button
              type="button"
              onClick={() => setForgotPassword(false)}
              className="text-pstudy-primary hover:underline"
            >
              ← Back to log in
            </button>
          ) : isSignUp ? (
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
              {" · "}
              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="text-pstudy-primary hover:underline"
              >
                Forgot password?
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
