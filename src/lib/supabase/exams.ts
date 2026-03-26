import { createClient } from "./client";
import { toError } from "./error-utils";
import type { Deck } from "@/types/pstudy";
import type {
  ExamPromptMode,
  ExamType,
  StraightGradingMode,
} from "@/lib/exam-validation";
import { fetchDeck } from "./decks";

export type ExamAssignmentRow = {
  id: string;
  deck_id: string;
  owner_id: string;
  duration_minutes: number;
  prompt_mode: ExamPromptMode;
  exam_type: ExamType;
  grading_mode: StraightGradingMode;
  created_at: string;
  updated_at: string;
};

export type ExamInviteRow = {
  id: string;
  assignment_id: string;
  email: string;
  access_token: string;
  created_at: string;
};

function generateAccessToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailLines(text: string): { valid: string[]; invalid: string[] } {
  const lines = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const e = line.toLowerCase();
    if (seen.has(e)) continue;
    seen.add(e);
    if (EMAIL_RE.test(e)) valid.push(e);
    else invalid.push(line);
  }
  return { valid, invalid };
}

export async function createExamAssignment(
  deckId: string,
  durationMinutes: number,
  promptMode: ExamPromptMode,
  examType: ExamType,
  gradingMode: StraightGradingMode,
  emailLines: string
): Promise<{ assignment: ExamAssignmentRow; invites: ExamInviteRow[] }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const deck = await fetchDeck(deckId);
  if (!deck) throw new Error("Deck not found");

  const { valid: emails, invalid } = parseEmailLines(emailLines);
  if (invalid.length > 0) {
    throw new Error(`Invalid email: ${invalid[0]}`);
  }
  if (emails.length === 0) {
    throw new Error("Add at least one examinee email");
  }

  const { data: assignment, error: aErr } = await supabase
    .from("exam_assignments")
    .insert({
      deck_id: deckId,
      owner_id: user.id,
      duration_minutes: durationMinutes,
      prompt_mode: promptMode,
      exam_type: examType,
      grading_mode: gradingMode,
    })
    .select()
    .single();

  if (aErr) throw toError(aErr);
  const row = assignment as ExamAssignmentRow;

  const { data: inserted, error: iErr } = await supabase
    .from("exam_invites")
    .insert(
      emails.map((email) => ({
        assignment_id: row.id,
        email,
        access_token: generateAccessToken(),
      }))
    )
    .select();

  if (iErr) throw toError(iErr);

  return {
    assignment: row,
    invites: (inserted ?? []) as ExamInviteRow[],
  };
}

export type ExamAssignmentSummary = ExamAssignmentRow & {
  deck: Pick<Deck, "id" | "title" | "items">;
  invite_count: number;
};

export async function fetchMyExamAssignments(): Promise<ExamAssignmentSummary[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("exam_assignments")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw toError(error);
  if (!rows?.length) return [];

  const assignmentIds = (rows as ExamAssignmentRow[]).map((r) => r.id);
  const countMap = new Map<string, number>();
  if (assignmentIds.length > 0) {
    const { data: inviteRows } = await supabase
      .from("exam_invites")
      .select("assignment_id")
      .in("assignment_id", assignmentIds);

    for (const row of inviteRows ?? []) {
      const aid = (row as { assignment_id: string }).assignment_id;
      countMap.set(aid, (countMap.get(aid) ?? 0) + 1);
    }
  }

  const out: ExamAssignmentSummary[] = [];
  for (const r of rows as ExamAssignmentRow[]) {
    const deck = await fetchDeck(r.deck_id);
    if (!deck) continue;
    out.push({
      ...r,
      deck: { id: deck.id, title: deck.title, items: deck.items },
      invite_count: countMap.get(r.id) ?? 0,
    });
  }
  return out;
}

export async function fetchExamAssignmentDetail(
  assignmentId: string
): Promise<{
  assignment: ExamAssignmentRow;
  deck: Deck;
  invites: ExamInviteRow[];
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: assignment, error } = await supabase
    .from("exam_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (error || !assignment) return null;
  const a = assignment as ExamAssignmentRow;
  if (a.owner_id !== user.id) return null;

  const deck = await fetchDeck(a.deck_id);
  if (!deck) return null;

  const { data: invites, error: iErr } = await supabase
    .from("exam_invites")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  if (iErr) throw toError(iErr);

  return {
    assignment: a,
    deck,
    invites: (invites ?? []) as ExamInviteRow[],
  };
}

export async function addInvitesToAssignment(
  assignmentId: string,
  emailLines: string
): Promise<ExamInviteRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data: assignment, error } = await supabase
    .from("exam_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();

  if (error || !assignment) throw new Error("Assignment not found");
  const a = assignment as ExamAssignmentRow;
  if (a.owner_id !== user.id) throw new Error("Not allowed");

  const { valid: emails, invalid } = parseEmailLines(emailLines);
  if (invalid.length > 0) throw new Error(`Invalid email: ${invalid[0]}`);
  if (emails.length === 0) throw new Error("Add at least one email");

  const rows = emails.map((email) => ({
    assignment_id: assignmentId,
    email,
    access_token: generateAccessToken(),
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("exam_invites")
    .insert(rows)
    .select();

  if (insErr) throw toError(insErr);
  return (inserted ?? []) as ExamInviteRow[];
}

/** Owner-only. Cascades to invites and attempts per DB schema. Does not delete the deck. */
export async function deleteExamAssignment(assignmentId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("exam_assignments")
    .delete()
    .eq("id", assignmentId)
    .select("id");

  if (error) throw toError(error);
  if (!data?.length) {
    throw new Error("Exam not found or you don't have permission to delete it");
  }
}
