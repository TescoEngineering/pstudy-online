import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { countAdminsInOrg, isOrgAdmin } from "@/lib/org-admin";
import type { OrganizationRole } from "@/types/organization";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    organizationId?: string;
    userId?: string;
    role?: OrganizationRole;
  } | null;

  const organizationId = body?.organizationId?.trim();
  const targetUserId = body?.userId?.trim();
  const role = body?.role;

  if (!organizationId || !targetUserId) {
    return bad("organizationId and userId required");
  }
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

  const { data: current } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (!current) return bad("Member not found", 404);

  const fromRole = current.role as string;
  if (fromRole === "admin" && role !== "admin") {
    const n = await countAdminsInOrg(admin, organizationId);
    if (n <= 1) {
      return bad("Cannot change the last admin to a non-admin role.");
    }
  }

  const { error: updErr } = await admin
    .from("organization_members")
    .update({ role })
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId);

  if (updErr) return bad(updErr.message || "Could not update role", 500);
  return NextResponse.json({ ok: true });
}
