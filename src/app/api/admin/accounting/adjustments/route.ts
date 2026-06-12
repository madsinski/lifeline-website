// GET    /api/admin/accounting/adjustments?month=YYYY-MM
// POST   /api/admin/accounting/adjustments — add a manual income/expense line
// DELETE /api/admin/accounting/adjustments?id=…
//
// Tables: supabase/migration-accounting.sql (accounting_adjustments).
// Manual corrections per month for anything the derived numbers miss
// (uncaptured blood test, actual USD card amount, refunds, …).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { MONTH_RE, monthBounds } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("accounting_adjustments")
    .select("id, month, kind, description, amount_isk, created_at")
    .eq("month", monthBounds(month).monthDate)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ adjustments: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const month = String(body?.month || "");
  const kind = body?.kind === "income" ? "income" : body?.kind === "expense" ? "expense" : null;
  const description = String(body?.description || "").trim();
  const amount = Number(body?.amount_isk);
  if (!MONTH_RE.test(month) || !kind || !description || !Number.isInteger(amount) || amount < 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("accounting_adjustments")
    .insert({
      month: monthBounds(month).monthDate,
      kind,
      description,
      amount_isk: amount,
      created_by: auth.id,
    })
    .select("id, month, kind, description, amount_isk, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, adjustment: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await supabaseAdmin.from("accounting_adjustments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
