// Business onboarding tester feedback — read / write / triage.
//
// Backs the "Tester feedback" composer in the /admin/business Testing guide
// tab and the admin "Test feedback" review tab. Table + RLS live in
// supabase/migration-business-test-feedback.sql (API-mediated; direct client
// access is blocked).
//
//   POST  — any active staff member submits a free-text note. Submitter
//           identity (email + name) is taken from their session, not the body.
//   GET   — admins see every note (optional ?status=open|resolved filter);
//           non-admin staff see only their own submissions (for the
//           "your notes" list in the guide).
//   PATCH — admins only (AAL2): mark a note resolved/open or attach a note.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY = 4000;

// Resolve the caller's staff row (role + permissions + name). Returns null
// for non-staff. `isAdmin` mirrors the admin layout: role admin or the
// manage_team permission.
async function staffContext(userId: string) {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("role, permissions, name, active")
    .eq("id", userId)
    .maybeSingle();
  if (!data || data.active !== true) return null;
  const perms = (data.permissions as string[] | null) ?? [];
  return {
    role: data.role as string,
    name: (data.name as string | null) ?? null,
    isAdmin: data.role === "admin" || perms.includes("manage_team"),
  };
}

export const POST = withErrorReporting(async (req: NextRequest) => {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "staff_access_required" }, { status: 403 });
  }
  const ctx = await staffContext(user.id);

  const payload = (await req.json().catch(() => ({}))) as {
    body?: string; step_key?: string | null; step_label?: string | null;
  };
  const body = (payload.body ?? "").trim();
  if (!body) return NextResponse.json({ error: "body_required" }, { status: 400 });
  if (body.length > MAX_BODY) {
    return NextResponse.json({ error: "body_too_long" }, { status: 400 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("business_test_feedback")
    .insert({
      tester_id: user.id,
      tester_email: user.email,
      tester_name: ctx?.name ?? null,
      step_key: payload.step_key?.toString().slice(0, 120) || null,
      step_label: payload.step_label?.toString().slice(0, 200) || null,
      body,
    })
    .select("id, created_at, step_label, body, status")
    .single();

  if (error) {
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, feedback: row });
}, { route: "POST /api/admin/business/test-feedback" });

export const GET = withErrorReporting(async (req: NextRequest) => {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "staff_access_required" }, { status: 403 });
  }
  const ctx = await staffContext(user.id);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let q = supabaseAdmin
    .from("business_test_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  // Non-admins only ever see their own submissions.
  if (!ctx?.isAdmin) q = q.eq("tester_email", user.email ?? "");
  if (status === "open" || status === "resolved") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "list_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ feedback: data ?? [], isAdmin: !!ctx?.isAdmin });
}, { route: "GET /api/admin/business/test-feedback" });

export const PATCH = withErrorReporting(async (req: NextRequest) => {
  const user = await requireAdminAAL2(req);
  if (user === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (user === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (user === "mfa_required") return NextResponse.json({ error: "mfa_required" }, { status: 403 });

  const payload = (await req.json().catch(() => ({}))) as {
    id?: string; status?: string; admin_note?: string | null;
  };
  if (!payload.id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (payload.status === "open" || payload.status === "resolved") {
    update.status = payload.status;
    update.resolved_at = payload.status === "resolved" ? new Date().toISOString() : null;
    update.resolved_by_email = payload.status === "resolved" ? user.email : null;
  }
  if (payload.admin_note !== undefined) {
    update.admin_note = payload.admin_note?.toString().slice(0, MAX_BODY) || null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("business_test_feedback")
    .update(update)
    .eq("id", payload.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, feedback: data });
}, { route: "PATCH /api/admin/business/test-feedback" });
