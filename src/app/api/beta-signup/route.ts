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

/**
 * Gate a private-beta signup: enforce the user cap (overflow -> waitlist) and
 * record the signup. The auth account itself is created client-side via
 * supabase.auth.signUp(), so that Supabase emails a 6-digit confirmation CODE
 * rather than a consumable link (school/corporate IT pre-fetch and burn links).
 * This route deliberately does NOT create the auth user.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();
  if (!admin) return bad("SUPABASE_SERVICE_ROLE_KEY is missing", 500);

  const cap = parseBetaCap();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Invalid JSON body");
  }

  const name = String(body.name ?? "").trim();
  const email = normalizeEmail(String(body.email ?? ""));
  const useCase = body.use_case_note ? String(body.use_case_note).trim() : null;
  const accepted = body.accepted_beta_terms === true;

  if (!name) return bad("Name is required");
  if (!email || !email.includes("@")) return bad("Valid email is required");
  if (!accepted) return bad("You must accept the beta terms");

  const { count, error: cErr } = await admin
    .from("beta_signups")
    .select("*", { count: "exact", head: true });
  if (cErr) return bad(cErr.message, 500);

  // A returning email (already recorded) is let through even if the cap is now
  // full — only brand-new emails count against the remaining slots.
  const { data: existing } = await admin
    .from("beta_signups")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  const isFull = !existing && (count ?? 0) >= cap;

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

  const { error: bErr } = await admin.from("beta_signups").upsert(
    {
      email,
      name,
      use_case_note: useCase,
      signup_source: "beta",
    },
    { onConflict: "email" }
  );
  if (bErr) return bad(bErr.message, 500);

  return NextResponse.json({ ok: true, status: "accepted" as const, email });
}
