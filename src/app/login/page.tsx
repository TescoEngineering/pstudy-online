"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash") ?? params.get("token");
    const type = params.get("type");
    if (params.get("recovery") === "1") {
      setRecoveryMode(true);
      window.history.replaceState(null, "", "/login");
      return;
    }
    if (tokenHash && (type === "recovery" || type === "email")) {
      window.location.replace(`/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type || "recovery"}`);
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
        toast.success(t("login.passwordUpdated"));
        window.history.replaceState(null, "", "/login");
        router.refresh();
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("");
        toast.success(t("login.confirmEmail"));
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (recoveryMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
        <div className="card w-full max-w-sm">
          <h1 className="mb-6 text-xl font-bold text-stone-900">{t("login.setNewPassword")}</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-1 block text-sm text-stone-600">
                {t("login.newPassword")}
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
              {loading ? t("login.updating") : t("login.updatePassword")}
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
          <h1 className="mb-4 text-xl font-bold text-stone-900">{t("login.checkEmail")}</h1>
          <p className="mb-6 text-stone-600">
            {t("login.checkEmailText", { email })}
          </p>
          <button
            type="button"
            onClick={() => {
              setResetSent(false);
              setForgotPassword(false);
            }}
            className="btn-primary w-full"
          >
            {t("login.backToLogIn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4">
      <Logo size="md" withText linkToHome className="mb-6" />
      <div className="card w-full max-w-sm">
        <h1 className="mb-6 text-xl font-bold text-stone-900">
          {forgotPassword ? t("login.resetPassword") : isSignUp ? t("login.createAccount") : t("login.logIn")}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-stone-600">
              {t("login.email")}
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
                {t("login.password")}
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
              ? t("login.pleaseWait")
              : forgotPassword
                ? t("login.sendResetLink")
                : isSignUp
                  ? t("login.signUp")
                  : t("login.logIn")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-600">
          {forgotPassword ? (
            <button
              type="button"
              onClick={() => setForgotPassword(false)}
              className="text-pstudy-primary hover:underline"
            >
              {t("login.backToLogIn")}
            </button>
          ) : isSignUp ? (
            <>
              {t("login.alreadyHaveAccount")}{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-pstudy-primary hover:underline"
              >
                {t("login.logIn")}
              </button>
            </>
          ) : (
            <>
              {t("login.noAccountYet")}{" "}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-pstudy-primary hover:underline"
              >
                {t("login.signUp")}
              </button>
              {" · "}
              <button
                type="button"
                onClick={() => setForgotPassword(true)}
                className="text-pstudy-primary hover:underline"
              >
                {t("login.forgotPassword")}
              </button>
            </>
          )}
        </p>

        <p className="mt-4 text-center text-sm text-stone-500">
          <Link href="/" className="text-pstudy-primary hover:underline">
            {t("login.backToHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}
