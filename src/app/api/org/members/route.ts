import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countAdminsInOrg,
  findAuthUserIdByEmail,
  isOrgAdmin,
  listOrgMembersWithEmails,
} from "@/lib/org-admin";
import { normalizeOrgInviteEmail } from "@/lib/org-invites";
import type { OrganizationRole } from "@/types/organization";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim();
  if (!organizationId) return bad("organizationId required");

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  if (!(await isOrgAdmin(admin, user.id, organizationId))) {
    return bad("Not allowed", 403);
  }

  const members = await listOrgMembersWithEmails(admin, organizationId);
  return NextResponse.json({ members });
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
  if (!user?.id) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  if (!(await isOrgAdmin(admin, user.id, organizationId))) {
    return bad("Not allowed", 403);
  }

  const targetUserId = await findAuthUserIdByEmail(admin, email);
  if (!targetUserId) {
    return bad(
      "No PSTUDY account exists for this email yet. Use “Send email invitation” instead.",
      404
    );
  }

  const { error: insErr } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: targetUserId,
    role,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return bad("This person is already in the organization.");
    }
    if (insErr.message?.includes("member limit")) {
      return bad(insErr.message);
    }
    return bad(insErr.message || "Could not add member", 500);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    userId?: string;
  } | null;
  const organizationId = body?.organizationId?.trim();
  const targetUserId = body?.userId?.trim();

  if (!organizationId || !targetUserId) {
    return bad("organizationId and userId required");
  }

  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  if (!(await isOrgAdmin(admin, user.id, organizationId))) {
    return bad("Not allowed", 403);
  }

  const { data: targetRow } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!targetRow) return bad("Member not found", 404);

  if ((targetRow.role as string) === "admin") {
    const n = await countAdminsInOrg(admin, organizationId);
    if (n <= 1) {
      return bad("Cannot remove the last admin for this school.");
    }
  }

  const { error: delErr } = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId);

  if (delErr) return bad(delErr.message || "Could not remove member", 500);
  return NextResponse.json({ ok: true });
}
