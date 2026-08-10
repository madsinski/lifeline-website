// Admin: enable/disable the personal and business login audiences. Writes to
// system_settings keys personal_login_enabled / business_login_enabled.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));

  const rows: { key: string; value: boolean; updated_by: string }[] = [];
  if (typeof body?.personal === "boolean") rows.push({ key: "personal_login_enabled", value: body.personal, updated_by: auth.id });
  if (typeof body?.business === "boolean") rows.push({ key: "business_login_enabled", value: body.business, updated_by: auth.id });
  if (!rows.length) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("system_settings")
    .upsert(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
