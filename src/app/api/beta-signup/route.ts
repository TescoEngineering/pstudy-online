import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

type Body = {
  name?: string;
  email?: string;
  use_case_note?: string | null;
  accepted_beta_terms?: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseBetaCap(): number {
  const raw = (process.env.BETA_SIGNUP_CAP ?? "").trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return n;
}

export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return bad("SUPABASE_SERVICE_ROLE_KEY is missing", 500);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Invalid JSON body");
  }

  const name = String(body.name ?? "").trim();
  const emailRaw = String(body.email ?? "");
  const email = normalizeEmail(emailRaw);
  const useCase = body.use_case_note ? String(body.use_case_note).trim() : null;
  const accepted = body.accepted_beta_terms === true;

  if (!name) return bad("Name is required");
  if (!email || !email.includes("@")) return bad("Valid email is required");
  if (!accepted) return bad("You must accept the beta terms");

  const { count, error: cErr } = await admin
    .from("beta_signups")
    .select("*", { count: "exact", head: true });
  if (cErr) return bad(cErr.message, 500);

  const cap = parseBetaCap();
  const isFull = (count ?? 0) >= cap;

  if (isFull) {
    const { error: wErr } = await admin.from("waitlist").insert({
      email,
      name,
      use_case_note: useCase,
      signup_source: "waitlist",
    });
    if (wErr) return bad(wErr.message, 500);
    return NextResponse.json({ ok: true, status: "waitlist" as const, email });
  }

  // Invite via Supabase auth (magic link / confirmation flow).
  const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      name,
      use_case_note: useCase,
      signup_source: "beta",
    },
  });

  // If the user already exists, we still treat this as accepted.
  if (invErr && !String(invErr.message ?? "").toLowerCase().includes("already")) {
    return bad(invErr.message || "Could not create user", 500);
  }

  const userId = inv?.user?.id ?? null;

  const { error: bErr } = await admin.from("beta_signups").insert({
    user_id: userId,
    email,
    name,
    use_case_note: useCase,
    signup_source: "beta",
  });

  if (bErr) return bad(bErr.message, 500);

  return NextResponse.json({ ok: true, status: "accepted" as const, email });
}

