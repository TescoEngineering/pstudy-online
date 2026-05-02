"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { AppHeader, AppHeaderLink } from "@/components/AppHeader";

export default function SignupPage() {
  const { t } = useTranslation();
  const betaTerms =
    "PSTUDY is in private beta — free for everyone, capped at 50 users. We expect to launch paid plans in Q3 2026 (July–September). When we do, beta users get 6 months free, then a locked-in price of €3.99/month (or €35/year) for as long as your subscription stays active. You'll receive at least 30 days notice before any change, and your decks are always exportable at any time.";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [acceptedBeta, setAcceptedBeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    null | { status: "accepted" | "waitlist"; email: string; userAlreadyExists?: boolean }
  >(null);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      acceptedBeta &&
      !submitting
    );
  }, [name, email, acceptedBeta, submitting]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
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
      const json = (await res.json()) as any;
      if (!res.ok) {
        setError(json?.error ? String(json.error) : t("common.somethingWentWrong"));
        return;
      }
      setResult({
        status: json.status,
        email: String(json.email ?? email.trim()),
        userAlreadyExists: Boolean(json.user_already_exists),
      });
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
        {result ? (
          <>
            <h1 className="text-3xl font-bold text-stone-900">
              {result.status === "accepted"
                ? result.userAlreadyExists
                  ? "Account already exists — please log in (or use password reset)."
                  : "Welcome — check your email to confirm your account."
                : "Beta is full — you're on the waitlist."}
            </h1>
            <p className="mt-3 text-stone-700">
              {result.status === "accepted"
                ? result.userAlreadyExists
                  ? `This email (${result.email}) already has a PSTUDY account. Please log in, or use password reset if needed.`
                  : `We sent a confirmation link to ${result.email}. Once confirmed, you can log in and start using PSTUDY.`
                : `We'll email ${result.email} when a spot opens or when paid plans launch.`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary">
                {t("home.logIn")}
              </Link>
              <Link href="/" className="btn-secondary">
                Back to home
              </Link>
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

              <button type="button" className="btn-primary w-full" disabled={!canSubmit} onClick={submit}>
                {submitting ? "Joining…" : "Join the beta"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

