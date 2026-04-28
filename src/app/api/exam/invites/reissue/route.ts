import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  assignmentId: string;
  email: string;
};

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function generateAccessToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.assignmentId || !body?.email) return bad("Missing assignmentId or email");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("SUPABASE_SERVICE_ROLE_KEY is missing", 500);

  const email = body.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return bad("Invalid email");

  // Verify ownership
  const { data: assignment, error: aErr } = await admin
    .from("exam_assignments")
    .select("id,owner_id")
    .eq("id", body.assignmentId)
    .single();
  if (aErr || !assignment) return bad("Assignment not found", 404);
  if (assignment.owner_id !== user.id) return bad("Not allowed", 403);

  // Revoke any existing active invites for that email
  await admin
    .from("exam_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("assignment_id", body.assignmentId)
    .eq("email", email)
    .is("revoked_at", null);

  const access_token = generateAccessToken();

  const { data: inserted, error: iErr } = await admin
    .from("exam_invites")
    .insert({
      assignment_id: body.assignmentId,
      email,
      access_token,
    })
    .select("*")
    .single();

  if (iErr) return bad(iErr.message, 500);

  return NextResponse.json({
    invite: inserted,
    accessToken: inserted.access_token,
  });
}

