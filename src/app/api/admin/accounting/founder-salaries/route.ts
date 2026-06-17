// Founders' salaries, editable month by month (Accounting tab).
//
// GET  /api/admin/accounting/founder-salaries?year=YYYY
//      → { default_isk, year, months: [{ month: "YYYY-MM", amount_isk,
//          is_set, note }] } — one entry per month of the year.
// POST /api/admin/accounting/founder-salaries
//      { month: "YYYY-MM", amount_isk: number|null, note?: string }
//      amount_isk null → clear the month (counts as 0 in the P&L).
//
// Table: supabase/migration-founder-salaries.sql
// (accounting_founder_salaries). The default is the founder_salary_default_isk
// setting — a pre-fill suggestion only, never auto-applied to a month.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DEFAULT_FALLBACK = 1_600_000;

async function defaultIsk(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("accounting_settings")
    .select("value_numeric")
    .eq("key", "founder_salary_default_isk")
    .maybeSingle();
  const v = data ? Number(data.value_numeric) : NaN;
  return Number.isFinite(v) && v > 0 ? Math.round(v) : DEFAULT_FALLBACK;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const yearParam = req.nextUrl.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getUTCFullYear();

  const [rowsRes, def] = await Promise.all([
    supabaseAdmin
      .from("accounting_founder_salaries")
      .select("month, amount_isk, note, sereign")
      .gte("month", `${year}-01-01`)
      .lte("month", `${year}-12-01`),
    defaultIsk(),
  ]);
  if (rowsRes.error) return NextResponse.json({ error: rowsRes.error.message }, { status: 500 });

  const byMonth = new Map<string, { amount_isk: number; note: string | null; sereign: boolean }>();
  for (const r of rowsRes.data || []) {
    byMonth.set(String(r.month).slice(0, 7), { amount_isk: Number(r.amount_isk) || 0, note: (r.note as string | null) ?? null, sereign: Boolean((r as { sereign?: boolean }).sereign) });
  }
  const months = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const hit = byMonth.get(key);
    return { month: key, amount_isk: hit?.amount_isk ?? 0, is_set: !!hit, note: hit?.note ?? null, sereign: hit?.sereign ?? false };
  });
  return NextResponse.json({ default_isk: def, year, months });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const month = String(body?.month || "");
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });
  const monthDate = `${month}-01`;

  const sereign = body.sereign !== undefined ? Boolean(body.sereign) : undefined;

  // Explicit null amount → clear the month (treated as 0 in the P&L).
  if (body.amount_isk === null) {
    const { error } = await supabaseAdmin.from("accounting_founder_salaries").delete().eq("month", monthDate);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, month, cleared: true });
  }

  // No amount but a séreign toggle → update just the flag on the existing month.
  if (body.amount_isk === undefined) {
    if (sereign === undefined) return NextResponse.json({ error: "no_fields" }, { status: 400 });
    const { error } = await supabaseAdmin
      .from("accounting_founder_salaries")
      .update({ sereign, updated_at: new Date().toISOString() })
      .eq("month", monthDate);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, month, sereign });
  }

  const amount = Number(body.amount_isk);
  if (!Number.isInteger(amount) || amount < 0) return NextResponse.json({ error: "bad_amount" }, { status: 400 });
  const note = body.note != null ? String(body.note).trim().slice(0, 200) || null : null;
  const row: Record<string, unknown> = { month: monthDate, amount_isk: amount, note, updated_at: new Date().toISOString() };
  if (sereign !== undefined) row.sereign = sereign;
  const { error } = await supabaseAdmin
    .from("accounting_founder_salaries")
    .upsert(row, { onConflict: "month" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, month, amount_isk: amount });
}
