"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ResultContent() {
  const searchParams = useSearchParams();
  const correct = Number(searchParams.get("correct") ?? 0);
  const wrong = Number(searchParams.get("wrong") ?? 0);
  const total = Number(searchParams.get("total") ?? 0);
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="mb-4 text-2xl font-bold text-stone-900">Practice complete</h1>
      <div className="card mb-6">
        <p className="text-4xl font-bold text-pstudy-primary">{pct}%</p>
        <p className="mt-2 text-stone-600">
          {correct} correct, {wrong} wrong — {total} total
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/dashboard" className="btn-primary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <div className="min-h-screen bg-stone-50 pt-8">
      <Suspense fallback={<p className="text-center text-stone-600">Loading...</p>}>
        <ResultContent />
      </Suspense>
    </div>
  );
}
