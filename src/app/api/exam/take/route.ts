import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildMcChoices,
  examPromptText,
  expectedAnswerText,
  normalizeLenientAnswer,
  type ExamPromptMode,
  type ExamType,
  type StraightGradingMode,
} from "@/lib/exam-validation";
import type { PStudyItem } from "@/types/pstudy";

type InviteRow = {
  id: string;
  assignment_id: string;
  email: string;
  access_token: string;
  revoked_at?: string | null;
};

type AssignmentRow = {
  id: string;
  deck_id: string;
  duration_minutes: number;
  prompt_mode: ExamPromptMode;
  exam_type: ExamType;
  grading_mode: StraightGradingMode;
};

type AttemptRow = {
  id: string;
  assignment_id: string;
  invite_id: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "expired";
  current_index: number;
  correct_count: number;
  wrong_count: number;
  total_questions: number;
  answers_json: unknown[];
};

type Question = {
  itemId: string;
  instruction: string;
  prompt: string;
  expected: string;
  pictureUrl: string;
  options?: string[];
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function mapAttempt(attempt: AttemptRow) {
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    submittedAt: attempt.submitted_at,
    currentIndex: attempt.current_index,
    answers: attempt.answers_json ?? [],
    correctCount: attempt.correct_count,
    wrongCount: attempt.wrong_count,
  };
}

async function getBundle(token: string) {
  const admin = createAdminClient();
  if (!admin) return { error: "SUPABASE_SERVICE_ROLE_KEY is missing" as const };

  const { data: invite, error: invErr } = await admin
    .from("exam_invites")
    .select("*")
    .eq("access_token", token)
    .single();
  if (invErr || !invite) return { error: "Invite not found or invalid token" as const };

  const inv = invite as InviteRow;
  if (inv.revoked_at) return { error: "This exam link was revoked" as const };
  const { data: assignment, error: assErr } = await admin
    .from("exam_assignments")
    .select("*")
    .eq("id", inv.assignment_id)
    .single();
  if (assErr || !assignment) return { error: "Assignment not found" as const };

  const a = assignment as AssignmentRow;
  const { data: deck, error: deckErr } = await admin
    .from("decks")
    .select("id,title")
    .eq("id", a.deck_id)
    .single();
  if (deckErr || !deck) return { error: "Deck not found" as const };

  const { data: items, error: itemsErr } = await admin
    .from("items")
    .select("*")
    .eq("deck_id", a.deck_id)
    .order("order");
  if (itemsErr) return { error: "Could not load exam items" as const };

  const mappedItems = (items ?? []) as PStudyItem[];
  const questions: Question[] = mappedItems.map((item) => ({
    itemId: item.id,
    instruction: String(item.instruction ?? "").trim(),
    prompt: examPromptText(item, a.prompt_mode),
    expected: expectedAnswerText(item, a.prompt_mode),
    pictureUrl: String(item.picture_url ?? "").trim(),
    ...(a.exam_type === "multiple-choice"
      ? { options: buildMcChoices(item, a.prompt_mode) }
      : {}),
  }));

  const { data: attempt } = await admin
    .from("exam_attempts")
    .select("*")
    .eq("invite_id", inv.id)
    .maybeSingle();

  return {
    admin,
    invite: inv,
    assignment: a,
    deck: deck as { id: string; title: string },
    questions,
    attempt: (attempt as AttemptRow | null) ?? null,
  };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return bad("Missing token");
  const bundle = await getBundle(token);
  if ("error" in bundle) return bad(bundle.error ?? "Server error", 500);

  return NextResponse.json({
    inviteEmail: bundle.invite.email,
    deckTitle: bundle.deck.title,
    durationMinutes: bundle.assignment.duration_minutes,
    promptMode: bundle.assignment.prompt_mode,
    examType: bundle.assignment.exam_type,
    gradingMode: bundle.assignment.grading_mode,
    questions: bundle.questions.map((q) => ({
      itemId: q.itemId,
      instruction: q.instruction,
      prompt: q.prompt,
      pictureUrl: q.pictureUrl,
      options: q.options,
    })),
    attempt: bundle.attempt ? mapAttempt(bundle.attempt) : null,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = body?.token as string | undefined;
  const action = body?.action as "start" | "save" | "submit" | undefined;
  if (!token || !action) return bad("Missing token or action");

  const bundle = await getBundle(token);
  if ("error" in bundle) return bad(bundle.error ?? "Server error", 500);

  const now = new Date();
  if (action === "start") {
    if (bundle.attempt?.status === "submitted") {
      return bad("This exam was already submitted", 409);
    }
    if (bundle.attempt?.status === "expired") {
      return bad("This exam time has expired", 409);
    }

    if (bundle.attempt && bundle.attempt.status === "in_progress") {
      return NextResponse.json({ attempt: mapAttempt(bundle.attempt), resumed: true });
    }

    const expiresAt = new Date(now.getTime() + bundle.assignment.duration_minutes * 60_000).toISOString();
    const { data, error } = await bundle.admin
      .from("exam_attempts")
      .insert({
        assignment_id: bundle.assignment.id,
        invite_id: bundle.invite.id,
        started_at: now.toISOString(),
        expires_at: expiresAt,
        status: "in_progress",
        current_index: 0,
        correct_count: 0,
        wrong_count: 0,
        total_questions: bundle.questions.length,
        answers_json: [],
      })
      .select("*")
      .single();
    if (error) return bad(error.message, 500);
    return NextResponse.json({ attempt: mapAttempt(data as AttemptRow) });
  }

  if (!bundle.attempt) return bad("Exam has not been started", 409);
  if (bundle.attempt.status === "submitted") return bad("Exam was already submitted", 409);

  const expires = new Date(bundle.attempt.expires_at);
  if (expires.getTime() <= now.getTime() && action !== "submit") {
    await bundle.admin
      .from("exam_attempts")
      .update({ status: "expired" })
      .eq("id", bundle.attempt.id);
    return bad("Exam time has expired", 409);
  }

  const answers = (body?.answers ?? []) as Array<{ answer: string }>;
  const currentIndex = Number(body?.currentIndex ?? 0);
  const safeAnswers = bundle.questions.map((_, idx) => ({
    answer: String(answers[idx]?.answer ?? ""),
  }));

  const grade = safeAnswers.reduce(
    (acc, a, idx) => {
      const q = bundle.questions[idx];
      if (!q) return acc;
      const given = String(a.answer ?? "");
      const expected = q.expected;
      const ok =
        bundle.assignment.exam_type === "multiple-choice"
          ? given.trim() === expected.trim()
          : bundle.assignment.grading_mode === "exact-match"
            ? given.trim() === expected.trim()
            : normalizeLenientAnswer(given) === normalizeLenientAnswer(expected);
      if (ok) acc.correct += 1;
      else acc.wrong += 1;
      return acc;
    },
    { correct: 0, wrong: 0 }
  );

  if (action === "save") {
    const { error } = await bundle.admin
      .from("exam_attempts")
      .update({
        current_index: Math.max(0, Math.min(currentIndex, bundle.questions.length - 1)),
        answers_json: safeAnswers,
        correct_count: grade.correct,
        wrong_count: grade.wrong,
      })
      .eq("id", bundle.attempt.id);
    if (error) return bad(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  const detailed = bundle.questions.map((q, idx) => {
    const given = safeAnswers[idx]?.answer ?? "";
    const expected = q.expected;
    const isCorrect =
      bundle.assignment.exam_type === "multiple-choice"
        ? given.trim() === expected.trim()
        : bundle.assignment.grading_mode === "exact-match"
          ? given.trim() === expected.trim()
          : normalizeLenientAnswer(given) === normalizeLenientAnswer(expected);
    return {
      itemId: q.itemId,
      prompt: q.prompt,
      expected,
      given,
      isCorrect,
    };
  });

  const { data, error } = await bundle.admin
    .from("exam_attempts")
    .update({
      answers_json: safeAnswers,
      correct_count: grade.correct,
      wrong_count: grade.wrong,
      current_index: bundle.questions.length,
      submitted_at: now.toISOString(),
      status: "submitted",
    })
    .eq("id", bundle.attempt.id)
    .select("*")
    .single();
  if (error) return bad(error.message, 500);

  return NextResponse.json({
    attempt: mapAttempt(data as AttemptRow),
    result: {
      total: bundle.questions.length,
      correct: grade.correct,
      wrong: grade.wrong,
      details: detailed,
    },
  });
}
