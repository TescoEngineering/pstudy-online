import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { ExamPromptMode, ExamType, StraightGradingMode } from "@/lib/exam-validation";

type InviteRow = {
  id: string;
  assignment_id: string;
  email: string;
  access_token: string;
};

type AssignmentRow = {
  id: string;
  deck_id: string;
  duration_minutes: number;
  prompt_mode: ExamPromptMode;
  exam_type: ExamType;
  grading_mode: StraightGradingMode;
};

type DeckRow = {
  id: string;
  title: string;
};

type AttemptRow = {
  id: string;
  invite_id: string;
  status: "in_progress" | "submitted" | "expired";
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  correct_count: number;
  wrong_count: number;
  total_questions: number;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(_request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return bad("Not logged in", 401);

  const { data: invites, error: invErr } = await supabase
    .from("exam_invites")
    .select("id,assignment_id,email,access_token")
    .is("revoked_at", null);

  if (invErr) return bad(invErr.message, 500);
  if (!invites?.length) return NextResponse.json({ items: [] });

  const assignmentIds = (invites ?? []).map((i: InviteRow) => i.assignment_id);
  const inviteIds = (invites ?? []).map((i: InviteRow) => i.id);

  const { data: assignments, error: assErr } = await supabase
    .from("exam_assignments")
    .select("id,deck_id,duration_minutes,prompt_mode,exam_type,grading_mode")
    .in("id", assignmentIds);
  if (assErr) return bad(assErr.message, 500);

  const deckIds = (assignments ?? []).map((a: AssignmentRow) => a.deck_id);
  const { data: decks, error: deckErr } = await supabase
    .from("decks")
    .select("id,title")
    .in("id", deckIds);
  if (deckErr) return bad(deckErr.message, 500);

  const { data: attempts, error: atErr } = await supabase
    .from("exam_attempts")
    .select("*")
    .in("invite_id", inviteIds);
  if (atErr) return bad(atErr.message, 500);

  const assignmentMap = new Map<string, AssignmentRow>();
  for (const a of assignments ?? []) assignmentMap.set(a.id, a);

  const deckMap = new Map<string, DeckRow>();
  for (const d of decks ?? []) deckMap.set(d.id, d);

  const attemptMap = new Map<string, AttemptRow>();
  for (const at of attempts ?? []) attemptMap.set(at.invite_id, at);

  const items = (invites ?? []).map((inv: InviteRow) => {
    const a = assignmentMap.get(inv.assignment_id);
    if (!a) return null;
    const deck = deckMap.get(a.deck_id);
    const attempt = attemptMap.get(inv.id);
    const isExpired =
      attempt?.status === "in_progress" &&
      new Date(attempt.expires_at).getTime() <= Date.now();
    const displayStatus = isExpired ? "expired" : attempt?.status;

    return {
      inviteId: inv.id,
      assignmentId: inv.assignment_id,
      token: inv.access_token,
      deckTitle: deck?.title ?? "Deck",
      examType: a.exam_type,
      gradingMode: a.grading_mode,
      promptMode: a.prompt_mode,
      durationMinutes: a.duration_minutes,
      status: displayStatus ? displayStatus : "not_started",
      startedAt: attempt?.started_at,
      expiresAt: attempt?.expires_at,
      submittedAt: attempt?.submitted_at ?? null,
      score: attempt
        ? {
            correct: attempt.correct_count,
            wrong: attempt.wrong_count,
            total: attempt.total_questions,
          }
        : null,
    };
  }).filter(Boolean);

  return NextResponse.json({ items });
}

