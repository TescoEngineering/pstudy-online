import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
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
  access_token: string;
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

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
    .select("id,assignment_id,email,access_token")
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

  const attemptByInvite = new Map<string, AttemptRow>();
  for (const at of attemptRows) attemptByInvite.set(at.invite_id, at);

  const questionCount = deckItems.length;
  const header: string[] = [
    "email",
    "status",
    "score_correct",
    "score_wrong",
    "score_total",
  ];
  for (let i = 0; i < questionCount; i++) {
    header.push(`Q${i + 1}_question`);
    header.push(`Q${i + 1}_expected`);
    header.push(`Q${i + 1}_given`);
    header.push(`Q${i + 1}_is_correct`);
  }

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(","));

  for (const inv of inviteRows) {
    const attempt = attemptByInvite.get(inv.id);
    const answers = attempt?.answers_json ?? [];

    const base = [
      inv.email,
      attempt?.status ?? "not_started",
      attempt?.correct_count ?? 0,
      attempt?.wrong_count ?? 0,
      attempt?.total_questions ?? questionCount,
    ];

    const perQ: string[] = [];
    for (let i = 0; i < questionCount; i++) {
      const item = deckItems[i];
      const expected = item ? expectedAnswerText(item, a.prompt_mode) : "";
      const given = String(answers[i]?.answer ?? "");
      const instruction = item ? String(item.instruction ?? "").trim() : "";
      const prompt = item ? examPromptText(item, a.prompt_mode) : "";
      const question = instruction || prompt || "";
      const isCorrect =
        a.exam_type === "multiple-choice"
          ? given.trim() === expected.trim()
          : a.grading_mode === "exact-match"
            ? given.trim() === expected.trim()
            : normalizeLenientAnswer(given) === normalizeLenientAnswer(expected);

      perQ.push(question);
      perQ.push(expected);
      perQ.push(given);
      perQ.push(isCorrect ? "1" : "0");
    }

    const row = [...base, ...perQ].map(csvEscape).join(",");
    lines.push(row);
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="exam-${assignmentId}-results.csv"`,
    },
  });
}

