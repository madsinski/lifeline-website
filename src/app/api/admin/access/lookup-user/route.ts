import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// Look up a user by email so an admin can grant them site access. We
// search clients_decrypted (which exposes full_name + email) and fall
// back to auth.users when no client row exists (staff, sales contacts,
// etc.).
export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = ((body?.email as string) || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  // Try the clients view first — has decrypted full_name.
  const { data: client } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle();
  if (client) return NextResponse.json({ ...client, source: "client" });

  // Fall back to auth.users via admin API.
  const { data: u } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const match = u?.users?.find((x) => (x.email || "").toLowerCase() === email);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    id: match.id,
    email: match.email,
    full_name: (match.user_metadata?.full_name as string) || null,
    source: "auth",
  });
}
