// GET    /api/admin/accounting/overheads — all overhead rows
// POST   /api/admin/accounting/overheads — create one
// PATCH  /api/admin/accounting/overheads — update fields by id
// DELETE /api/admin/accounting/overheads?id=… — hard delete
//
// Tables: supabase/migration-accounting.sql (accounting_overheads).
// ISK items use amount_isk; USD-billed SaaS uses amount_usd and is
// converted with the month FX rate at report time. Prefer deactivating
// (active=false / effective_to) over deleting once a row has been part
// of a sent report.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("accounting_overheads")
    .select("id, name, amount_isk, amount_usd, quantity, active, effective_from, effective_to, note, created_at")
    .order("active", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ overheads: data || [] });
}

type OverheadPatch = {
  name?: string;
  amount_isk?: number | null;
  amount_usd?: number | null;
  quantity?: number;
  active?: boolean;
  effective_to?: string | null;
  note?: string | null;
};

function sanitize(body: Record<string, unknown>, forCreate: boolean): OverheadPatch | null {
  const out: OverheadPatch = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return null;
    out.name = name;
  }
  if (body.amount_isk !== undefined) {
    out.amount_isk = body.amount_isk === null ? null : Number(body.amount_isk);
    if (out.amount_isk !== null && (!Number.isInteger(out.amount_isk) || out.amount_isk < 0)) return null;
  }
  if (body.amount_usd !== undefined) {
    out.amount_usd = body.amount_usd === null ? null : Number(body.amount_usd);
    if (out.amount_usd !== null && (!Number.isFinite(out.amount_usd) || out.amount_usd < 0)) return null;
  }
  if (body.quantity !== undefined) {
    out.quantity = Number(body.quantity);
    if (!Number.isInteger(out.quantity) || out.quantity < 1) return null;
  }
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.effective_to !== undefined) {
    out.effective_to = body.effective_to === null ? null : String(body.effective_to);
    if (out.effective_to !== null && !/^\d{4}-\d{2}-\d{2}$/.test(out.effective_to)) return null;
  }
  if (body.note !== undefined) out.note = body.note === null ? null : String(body.note);
  if (forCreate) {
    if (!out.name) return null;
    if (out.amount_isk == null && out.amount_usd == null) return null;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const fields = sanitize(body, true);
  if (!fields) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("accounting_overheads")
    .insert(fields)
    .select("id, name, amount_isk, amount_usd, quantity, active, effective_from, effective_to, note")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, overhead: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  const fields = sanitize(body, false);
  if (!id || !fields || Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("accounting_overheads")
    .update(fields)
    .eq("id", id)
    .select("id, name, amount_isk, amount_usd, quantity, active, effective_from, effective_to, note")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, overhead: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await supabaseAdmin.from("accounting_overheads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
