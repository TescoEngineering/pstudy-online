"use client";

import { useState, useLayoutEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/Toast";
import { Logo } from "@/components/Logo";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.7 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a18.2 18.2 0 0 1-2.2 3.2" />
      <path d="M6.6 6.6A18.3 18.3 0 0 0 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.5" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authLinkFailed, setAuthLinkFailed] = useState(false);

  const needsPasswordConfirmation = isSignUp || recoveryMode;
  const passwordMismatch =
    needsPasswordConfirmation &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash") ?? params.get("token");
    const type = params.get("type");
    if (tokenHash && (type === "recovery" || type === "email")) {
      window.location.replace(
        `/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type || "recovery"}`
      );
      return;
    }
    if (params.get("recovery") === "1") {
      setRecoveryMode(true);
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", "/login");
      return;
    }
    if (params.get("error") === "auth") {
      setAuthLinkFailed(true);
      params.delete("error");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `/login?${rest}` : "/login");
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
        if (passwordMismatch) {
          setError(t("login.passwordsDoNotMatch"));
          return;
        }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setRecoveryMode(false);
        setPassword("");
        setConfirmPassword("");
        toast.success(t("login.passwordUpdated"));
        window.history.replaceState(null, "", "/login");
        router.refresh();
      } else if (isSignUp) {
        if (passwordMismatch) {
          setError(t("login.passwordsDoNotMatch"));
          return;
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("");
        toast.success(t("login.confirmEmail"));
        setIsSignUp(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const next =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("next")
            : null;
        const dest =
          next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
        router.push(dest);
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
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                >
                  {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="mb-1 block text-sm text-stone-600">
                {t("login.confirmPassword")}
              </label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={
                    showConfirmPassword ? t("login.hidePassword") : t("login.showPassword")
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {passwordMismatch ? (
                <p className="mt-1 text-sm text-red-600">{t("login.passwordsDoNotMatch")}</p>
              ) : null}
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

        {authLinkFailed && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            <p className="mb-2">{t("login.authLinkInvalid")}</p>
            <button
              type="button"
              onClick={() => setAuthLinkFailed(false)}
              className="text-pstudy-primary underline hover:no-underline"
            >
              {t("login.dismissHint")}
            </button>
          </div>
        )}

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
                {isSignUp ? t("login.newPassword") : t("login.password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={isSignUp && showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                  placeholder="••••••••"
                />
                {isSignUp && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          {isSignUp && !forgotPassword && (
            <div>
              <label htmlFor="confirm-password" className="mb-1 block text-sm text-stone-600">
                {t("login.confirmPassword")}
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={
                    showConfirmPassword ? t("login.hidePassword") : t("login.showPassword")
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-500 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-pstudy-primary"
                >
                  {showConfirmPassword ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {passwordMismatch ? (
                <p className="mt-1 text-sm text-red-600">{t("login.passwordsDoNotMatch")}</p>
              ) : null}
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
          {" · "}
          <Link href="/help" className="text-pstudy-primary hover:underline">
            {t("help.nav")}
          </Link>
        </p>
      </div>
    </div>
  );
}
