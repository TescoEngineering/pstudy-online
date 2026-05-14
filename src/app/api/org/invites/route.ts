import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail, isOrgAdmin } from "@/lib/org-admin";
import { normalizeOrgInviteEmail } from "@/lib/org-invites";
import { ensurePendingOrgInvite } from "@/lib/org-invite-workflow";
import type { OrganizationRole } from "@/types/organization";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    email?: string;
    role?: OrganizationRole;
  } | null;

  const organizationId = body?.organizationId?.trim();
  const email = normalizeOrgInviteEmail(body?.email ?? "");
  const role = body?.role;

  if (!organizationId) return bad("organizationId required");
  if (!email) return bad("Valid email required");
  if (role !== "student" && role !== "teacher" && role !== "admin") {
    return bad("role must be student, teacher, or admin");
  }

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id || !user.email) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  if (!(await isOrgAdmin(admin, user.id, organizationId))) {
    return bad("Not allowed", 403);
  }

  if (email === user.email.toLowerCase()) {
    return bad("Use another email address for invitations.");
  }

  const existingId = await findAuthUserIdByEmail(admin, email);
  if (existingId) {
    const { data: mem } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("user_id", existingId)
      .maybeSingle();
    if (mem) {
      return bad("This person is already a member of the organization.");
    }
  }

  try {
    const { reused, emailed } = await ensurePendingOrgInvite(admin, request, {
      organizationId,
      emailNormalized: email,
      role,
      invitedByUserId: user.id,
    });
    if (reused) {
      return NextResponse.json({ ok: true, emailed: false, reusedPendingInvite: true });
    }
    return NextResponse.json({ ok: true, emailed });
  } catch (insErr: unknown) {
    const code = (insErr as { code?: string })?.code;
    if (code === "23505") {
      return bad("A pending invitation already exists for this email.");
    }
    const message = insErr instanceof Error ? insErr.message : "Could not create invitation";
    return bad(message, 500);
  }
}
