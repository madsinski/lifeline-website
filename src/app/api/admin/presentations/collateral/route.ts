import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Editable content for the Fjarlækningar × HSU print collateral.
// Backed by supabase/migration-presentation-collateral.sql (single row, id = 1).

// GET — return the stored content blob (any active staff). Empty `{}` when unset;
// the client merges it over DEFAULT_CONTENT.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("presentation_collateral")
    .select("data, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.data ?? {}, updated_at: data?.updated_at ?? null });
}

// PUT — replace the content blob (admin + AAL2).
export async function PUT(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }

  let body: { data?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("presentation_collateral")
    .upsert({ id: 1, data: body.data, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
