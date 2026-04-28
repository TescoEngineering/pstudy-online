"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useTranslation } from "@/lib/i18n";
import { HelpNavLink } from "@/components/HelpNavLink";

function ResultLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4">
      <p className="text-stone-600">{t("common.loading")}</p>
      <HelpNavLink />
    </div>
  );
}

function ResultContent() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const correct = Number(searchParams.get("correct") ?? 0);
  const wrong = Number(searchParams.get("wrong") ?? 0);
  const total = Number(searchParams.get("total") ?? 0);
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <div className="mb-6 flex justify-end text-sm">
        <HelpNavLink />
      </div>
      <h1 className="mb-4 text-2xl font-bold text-stone-900">{t("result.complete")}</h1>
      <div className="card mb-6">
        <p className="text-4xl font-bold text-pstudy-primary">{pct}%</p>
        <p className="mt-2 text-stone-600">
          {t("result.summary", { correct, wrong, total })}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/dashboard" className="btn-primary">
          {t("result.backToDashboard")}
        </Link>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <div className="min-h-screen bg-stone-50 pt-8">
      <Suspense fallback={<ResultLoadingFallback />}>
        <ResultContent />
      </Suspense>
    </div>
  );
}
