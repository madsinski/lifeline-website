// Per-company income quantity overrides for the Pricing block.
//
// GET  /api/admin/accounting/income-items?company_id=… → override rows
// POST /api/admin/accounting/income-items
//      { company_id, item: 'health_check'|'followup'|'app', qty }
//      qty null → back to auto (the group roster count).
//
// Tables: supabase/migration-accounting.sql (company_income_item_qty).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ITEMS = ["health_check", "followup", "app"];

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const companyId = req.nextUrl.searchParams.get("company_id") || "";
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("company_income_item_qty")
    .select("item, qty")
    .eq("company_id", companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const companyId = String(body?.company_id || "");
  const item = String(body?.item || "");
  const qty = body?.qty === null || body?.qty === undefined ? null : Number(body.qty);
  if (!UUID_RE.test(companyId) || !ITEMS.includes(item)
      || (qty !== null && (!Number.isInteger(qty) || qty < 0))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (qty === null) {
    const { error } = await supabaseAdmin
      .from("company_income_item_qty")
      .delete()
      .eq("company_id", companyId)
      .eq("item", item);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, item, qty: null });
  }
  const { error } = await supabaseAdmin
    .from("company_income_item_qty")
    .upsert(
      { company_id: companyId, item, qty, updated_at: new Date().toISOString() },
      { onConflict: "company_id,item" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item, qty });
}
