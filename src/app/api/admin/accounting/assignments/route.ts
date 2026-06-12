// Company work assignments — who does the doctor interviews and
// measurements for a company.
//
// GET    /api/admin/accounting/assignments[?company_id=…]
//        → assignments (with staff + company names) and the active
//          staff list for the pickers
// POST   /api/admin/accounting/assignments
//        { company_id, role: 'doctor'|'measurer', staff_id,
//          client_count?: number|null }   — null/omitted = whole company
// DELETE /api/admin/accounting/assignments?id=…
//
// Tables: supabase/migration-accounting.sql (company_work_assignments).
// The per-doctor salary split in the Accounting tab is derived from
// these rows: clients covered × the doctor-interview/measurement rate.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_COLS =
  "id, company_id, role, staff_id, client_count, note, created_at, staff:staff_id(name, email), company:companies(name)";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const companyId = req.nextUrl.searchParams.get("company_id");
  let q = supabaseAdmin
    .from("company_work_assignments")
    .select(SELECT_COLS)
    .order("created_at", { ascending: true });
  if (companyId) q = q.eq("company_id", companyId);
  const [assignRes, staffRes] = await Promise.all([
    q,
    supabaseAdmin
      .from("staff")
      .select("id, name, email, role")
      .eq("active", true)
      .order("name"),
  ]);
  if (assignRes.error) return NextResponse.json({ error: assignRes.error.message }, { status: 500 });
  return NextResponse.json({
    assignments: assignRes.data || [],
    staff: staffRes.data || [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const companyId = String(body?.company_id || "");
  const role = body?.role === "doctor" ? "doctor" : body?.role === "measurer" ? "measurer" : null;
  const staffId = String(body?.staff_id || "");
  const clientCount = body?.client_count == null ? null : Number(body.client_count);
  if (!UUID_RE.test(companyId) || !role || !UUID_RE.test(staffId)
      || (clientCount !== null && (!Number.isInteger(clientCount) || clientCount < 1))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("company_work_assignments")
    .insert({
      company_id: companyId,
      role,
      staff_id: staffId,
      client_count: clientCount,
      note: body?.note ? String(body.note).trim() : null,
      created_by: auth.id,
    })
    .select(SELECT_COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, assignment: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await supabaseAdmin.from("company_work_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
