import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  examPromptText,
  expectedAnswerText,
  normalizeLenientAnswer,
  type ExamPromptMode,
  type ExamType,
  type StraightGradingMode,
} from "@/lib/exam-validation";
import type { PStudyItem } from "@/types/pstudy";

type AssignmentRow = {
  id: string;
  owner_id: string;
  deck_id: string;
  prompt_mode: ExamPromptMode;
  exam_type: ExamType;
  grading_mode: StraightGradingMode;
};

type InviteRow = {
  id: string;
  assignment_id: string;
  email: string;
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
  answers_json: Array<{ answer: string }>;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: NextRequest) {
  const assignmentId = request.nextUrl.searchParams.get("assignmentId");
  if (!assignmentId) return bad("Missing assignmentId");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("SUPABASE_SERVICE_ROLE_KEY is missing", 500);

  const { data: assignment, error: aErr } = await admin
    .from("exam_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();
  if (aErr || !assignment) return bad("Assignment not found", 404);
  const a = assignment as AssignmentRow;
  if (a.owner_id !== user.id) return bad("Not allowed", 403);

  const { data: invites, error: iErr } = await admin
    .from("exam_invites")
    .select("id,assignment_id,email")
    .eq("assignment_id", assignmentId)
    .order("created_at");
  if (iErr) return bad(iErr.message, 500);
  const inviteRows = (invites ?? []) as InviteRow[];

  const { data: attempts, error: atErr } = await admin
    .from("exam_attempts")
    .select("*")
    .eq("assignment_id", assignmentId);
  if (atErr) return bad(atErr.message, 500);
  const attemptRows = (attempts ?? []) as AttemptRow[];

  const { data: items, error: itemErr } = await admin
    .from("items")
    .select("*")
    .eq("deck_id", a.deck_id)
    .order("order");
  if (itemErr) return bad(itemErr.message, 500);
  const deckItems = (items ?? []) as PStudyItem[];

  const results = inviteRows.map((inv) => {
    const attempt = attemptRows.find((x) => x.invite_id === inv.id);
    if (!attempt) {
      return {
        inviteId: inv.id,
        email: inv.email,
        status: "not_started" as const,
      };
    }

    const answerRows = attempt.answers_json ?? [];
    const details = deckItems.map((item, idx) => {
      const instruction = String(item.instruction ?? "").trim();
      const prompt = examPromptText(item, a.prompt_mode);
      const expected = expectedAnswerText(item, a.prompt_mode);
      const given = String(answerRows[idx]?.answer ?? "");
      const isCorrect =
        a.exam_type === "multiple-choice"
          ? given.trim() === expected.trim()
          : a.grading_mode === "exact-match"
            ? given.trim() === expected.trim()
            : normalizeLenientAnswer(given) === normalizeLenientAnswer(expected);
      return {
        instruction,
        prompt,
        expected,
        given,
        isCorrect,
      };
    });

    return {
      inviteId: inv.id,
      email: inv.email,
      status: attempt.status,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      score: {
        correct: attempt.correct_count,
        wrong: attempt.wrong_count,
        total: attempt.total_questions || deckItems.length,
      },
      details,
    };
  });

  return NextResponse.json({ results });
}
