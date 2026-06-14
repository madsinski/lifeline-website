// Per-company fixed cost-item state (blood tests / measurements /
// doctor interviews on the company card).
//
// GET  /api/admin/accounting/cost-items?company_id=… → items + active
//      staff list for the assignee pickers
// POST /api/admin/accounting/cost-items — upsert
//      { company_id, category, status?, provider?, staff_id? }
//      status: auto|outstanding|invoice_pending|covered|not_applicable
//      provider: blood-test deliverer (Sameind / Heilsugæslan)
//      staff_id: who does measurements / doctor interviews — also the
//      source of the per-staff salary split in Accounting.
//
// Tables: supabase/migration-accounting.sql (company_cost_item_status).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ["blood_tests", "measurements", "doctor"];
const STATUSES = ["auto", "outstanding", "invoice_pending", "covered", "not_applicable"];

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const companyId = req.nextUrl.searchParams.get("company_id") || "";
  if (!UUID_RE.test(companyId)) return NextResponse.json({ error: "bad_company" }, { status: 400 });
  const [itemsRes, staffRes] = await Promise.all([
    supabaseAdmin
      .from("company_cost_item_status")
      // select("*") (+ the staff join) so a not-yet-applied head_count
      // migration can't 500 this read.
      .select("*, staff:staff_id(name, email)")
      .eq("company_id", companyId),
    supabaseAdmin
      .from("staff")
      .select("id, name, email, role")
      .eq("active", true)
      .order("name"),
  ]);
  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
  return NextResponse.json({ items: itemsRes.data || [], staff: staffRes.data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const companyId = String(body?.company_id || "");
  const category = String(body?.category || "");
  if (!UUID_RE.test(companyId) || !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const row: Record<string, unknown> = {
    company_id: companyId,
    category,
    updated_at: new Date().toISOString(),
  };
  if (body.status !== undefined) {
    if (!STATUSES.includes(String(body.status))) return NextResponse.json({ error: "bad_status" }, { status: 400 });
    row.status = body.status;
  }
  if (body.provider !== undefined) {
    row.provider = body.provider === null ? null : String(body.provider).trim().slice(0, 80) || null;
  }
  if (body.staff_id !== undefined) {
    if (body.staff_id !== null && !UUID_RE.test(String(body.staff_id))) {
      return NextResponse.json({ error: "bad_staff" }, { status: 400 });
    }
    row.staff_id = body.staff_id;
  }
  if (body.unit_price_isk !== undefined) {
    const n = body.unit_price_isk === null ? null : Number(body.unit_price_isk);
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      return NextResponse.json({ error: "bad_price" }, { status: 400 });
    }
    row.unit_price_isk = n;
  }
  if (body.head_count !== undefined) {
    const n = body.head_count === null ? null : Number(body.head_count);
    if (n !== null && (!Number.isInteger(n) || n < 0)) {
      return NextResponse.json({ error: "bad_head_count" }, { status: 400 });
    }
    row.head_count = n;
  }
  const { data, error } = await supabaseAdmin
    .from("company_cost_item_status")
    .upsert(row, { onConflict: "company_id,category" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
