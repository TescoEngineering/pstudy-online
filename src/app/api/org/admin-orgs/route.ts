import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listAdminOrganizations } from "@/lib/org-admin";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const server = await createServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();
  if (!user?.id) return bad("Not logged in", 401);

  const admin = createAdminClient();
  if (!admin) return bad("Server configuration error", 500);

  const organizations = await listAdminOrganizations(admin, user.id);
  return NextResponse.json({ organizations });
}
