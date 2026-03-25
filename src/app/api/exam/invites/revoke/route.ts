import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  assignmentId: string;
  inviteId: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.assignmentId || !body?.inviteId) return bad("Missing assignmentId or inviteId");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("SUPABASE_SERVICE_ROLE_KEY is missing", 500);

  // Verify ownership
  const { data: assignment, error: aErr } = await admin
    .from("exam_assignments")
    .select("id,owner_id")
    .eq("id", body.assignmentId)
    .single();
  if (aErr || !assignment) return bad("Assignment not found", 404);
  if (assignment.owner_id !== user.id) return bad("Not allowed", 403);

  const { error: uErr } = await admin
    .from("exam_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.inviteId)
    .eq("assignment_id", body.assignmentId);

  if (uErr) return bad(uErr.message, 500);

  return NextResponse.json({ ok: true });
}

