// GET  /api/admin/accounting/fx?month=YYYY-MM — month's USD/ISK rate,
//      auto-fetching from open.er-api.com and storing it if absent.
// POST /api/admin/accounting/fx — manual override { month, usd_isk }
//
// Tables: supabase/migration-accounting.sql (accounting_fx_rates).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { MONTH_RE, monthBounds, getFxRate } from "@/lib/accounting";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: "bad_month" }, { status: 400 });
  const fx = await getFxRate(month);
  return NextResponse.json({ fx });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const month = String(body?.month || "");
  const rate = Number(body?.usd_isk);
  if (!MONTH_RE.test(month) || !Number.isFinite(rate) || rate <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const row = {
    month: monthBounds(month).monthDate,
    usd_isk: Math.round(rate * 10_000) / 10_000,
    source: "manual",
    fetched_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from("accounting_fx_rates")
    .upsert(row, { onConflict: "month" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, fx: row });
}
