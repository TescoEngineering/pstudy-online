"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

export default function SignupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const betaTerms =
    "PSTUDY is in private beta — free for everyone, capped at 50 users. We expect to launch paid plans in Q3 2026 (July–September). When we do, beta users get 6 months free, then a locked-in price of €3.99/month (or €35/year) for as long as your subscription stays active. You'll receive at least 30 days notice before any change, and your decks are always exportable at any time.";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useCase, setUseCase] = useState("");
  const [acceptedBeta, setAcceptedBeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "code" | "waitlist">("form");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 6 &&
      acceptedBeta &&
      !submitting
    );
  }, [name, email, password, acceptedBeta, submitting]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      // 1) Gate against the beta cap + record the signup (server, service role).
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          use_case_note: useCase.trim() || null,
          accepted_beta_terms: acceptedBeta,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        status?: "accepted" | "waitlist";
        error?: string;
      };
      if (!res.ok) {
        setError(json?.error ? String(json.error) : t("common.somethingWentWrong"));
        return;
      }
      if (json.status === "waitlist") {
        setStep("waitlist");
        return;
      }
      // 2) Create the account — Supabase emails a 6-digit confirmation code
      //    (no consumable link, so school/corporate IT can't break it).
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), signup_source: "beta" } },
      });
      if (signUpError) {
        const m = signUpError.message.toLowerCase();
        if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
          setError("This email already has a PSTUDY account. Please log in instead.");
        } else {
          setError(signUpError.message);
        }
        return;
      }
      // If email confirmation is disabled in Supabase, signUp returns a session
      // and the user is already in — skip the code step.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "signup",
      });
      if (verifyError) throw verifyError;
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code was invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (resendError) throw resendError;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWentWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <AppHeader
        nav={
          <>
            <AppHeaderLink href="/pricing">Pricing</AppHeaderLink>
            <AppHeaderLink href="/for-schools">For Schools</AppHeaderLink>
            <AppHeaderLink href="/help">{t("help.nav")}</AppHeaderLink>
            <AppHeaderLink href="/login">{t("home.logIn")}</AppHeaderLink>
          </>
        }
      />

      <main className="mx-auto max-w-xl px-4 py-14">
        {step === "waitlist" ? (
          <>
            <h1 className="text-3xl font-bold text-stone-900">
              Beta is full — you&apos;re on the waitlist.
            </h1>
            <p className="mt-3 text-stone-700">
              We&apos;ll email {email} when a spot opens or when paid plans launch.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/" className="btn-primary">
                Back to home
              </Link>
            </div>
          </>
        ) : step === "code" ? (
          <>
            <h1 className="text-3xl font-bold text-stone-900">Confirm your account</h1>
            <p className="mt-3 text-stone-700">
              We emailed a 6-digit code to {email}. Enter it below to finish creating your account.
            </p>
            <div className="mt-8 max-w-sm space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-stone-800">6-digit code</div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 tracking-widest text-stone-900 shadow-sm focus:border-teal-500 focus:outline-none"
                />
              </label>
              {error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {error}
                </div>
              ) : null}
              <button
                type="button"
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting || !code.trim()}
                onClick={verifyCode}
              >
                {submitting ? "Verifying…" : "Verify code"}
              </button>
              <button
                type="button"
                className="text-sm text-pstudy-primary hover:underline"
                onClick={resendCode}
              >
                Resend code
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-stone-900">Join the PSTUDY private beta</h1>
            <p className="mt-2 text-stone-700">Free during beta. 50 spots, then a waitlist.</p>

            <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-950">
              {betaTerms}
            </div>

            <div className="mt-8 space-y-4">
              <label className="block">
                <div className="mb-1 text-sm font-medium text-stone-800">Name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-teal-500 focus:outline-none"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-stone-800">Email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-teal-500 focus:outline-none"
                  type="email"
                  required
                />
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-stone-800">Password</div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-teal-500 focus:outline-none"
                  type="password"
                  minLength={6}
                  required
                />
                <div className="mt-1 text-xs text-stone-500">At least 6 characters.</div>
              </label>

              <label className="block">
                <div className="mb-1 text-sm font-medium text-stone-800">
                  What will you use PSTUDY for? <span className="text-stone-500">(optional)</span>
                </div>
                <textarea
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  className="w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-teal-500 focus:outline-none"
                  rows={3}
                />
              </label>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={acceptedBeta}
                  onChange={(e) => setAcceptedBeta(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-stone-300"
                />
                <span className="text-sm text-stone-700">
                  I understand PSTUDY is in private beta and the product may change. I have read and
                  accept the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-pstudy-primary underline hover:no-underline"
                  >
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-pstudy-primary underline hover:no-underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              {error ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {error}
                </div>
              ) : null}

              <button
                type="button"
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSubmit}
                onClick={submit}
              >
                {submitting ? "Joining…" : "Join the beta"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
