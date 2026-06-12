// GET  /api/admin/accounting/rates — all cost-rate rows (history included)
// POST /api/admin/accounting/rates — add a new date-effective rate
//
// Tables: supabase/migration-accounting.sql (accounting_cost_rates).
// Rates are append-only: a price change is a NEW row with a new
// effective_from, so historical months keep the rate that applied.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("accounting_cost_rates")
    .select("id, rate_key, label, amount_isk, effective_from, created_at")
    .order("rate_key")
    .order("effective_from", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rates: data || [] });
}

const RATE_KEYS = ["blood_test", "measurement", "doctor_interview"];

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const rateKey = String(body?.rate_key || "");
  const label = String(body?.label || "").trim();
  const amount = Number(body?.amount_isk);
  const effectiveFrom = String(body?.effective_from || "");
  if (!RATE_KEYS.includes(rateKey) || !label || !Number.isInteger(amount) || amount < 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("accounting_cost_rates")
    .upsert(
      { rate_key: rateKey, label, amount_isk: amount, effective_from: effectiveFrom, created_by: auth.id },
      { onConflict: "rate_key,effective_from" },
    )
    .select("id, rate_key, label, amount_isk, effective_from")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rate: data });
}
