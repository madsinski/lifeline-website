// Admin API behind /admin/security — list intruder-scan findings and
// act on them (run a scan now, dismiss, block / unblock sign-in,
// delete the account). Admin role + MFA required for everything.
// Table: supabase/migration-security-findings.sql.

import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { BAN_DURATION, runIntruderScan } from "@/lib/intruder-scan";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin(req: NextRequest): Promise<User | NextResponse> {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const { data: me } = await supabaseAdmin.from("staff").select("role, active").eq("id", auth.id).maybeSingle();
  if (!me?.active || me.role !== "admin") {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  return auth;
}

async function isStaffEmail(email: string | null): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabaseAdmin.from("staff").select("id").ilike("email", email).maybeSingle();
  return !!data;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { data, error } = await supabaseAdmin
    .from("security_findings")
    .select("*")
    .order("first_seen_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ findings: data || [] });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action === "scan") {
    try {
      return NextResponse.json({ ok: true, ...(await runIntruderScan()) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "scan_failed" }, { status: 500 });
    }
  }

  const id = body?.id as string | undefined;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { data: finding } = await supabaseAdmin.from("security_findings").select("*").eq("id", id).maybeSingle();
  if (!finding) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const close = (status: "dismissed" | "resolved", action_taken: string | null) =>
    supabaseAdmin
      .from("security_findings")
      .update({
        status,
        action_taken: action_taken ?? finding.action_taken,
        note: typeof body?.note === "string" ? body.note.slice(0, 2000) : finding.note,
        resolved_at: new Date().toISOString(),
        resolved_by_email: admin.email,
      })
      .eq("id", id);

  if (action === "dismiss") {
    const { error } = await close("dismissed", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reopen") {
    const { error } = await supabaseAdmin
      .from("security_findings")
      .update({ status: "open", resolved_at: null, resolved_by_email: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Everything below acts on the account itself.
  if (!finding.user_id) return NextResponse.json({ error: "This finding is not tied to one account." }, { status: 400 });
  if (await isStaffEmail(finding.email)) {
    return NextResponse.json({ error: "This is a staff account — remove it from Team instead." }, { status: 400 });
  }

  if (action === "ban" || action === "unban") {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(finding.user_id, {
      ban_duration: action === "ban" ? BAN_DURATION : "none",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin
      .from("security_findings")
      .update({ action_taken: action === "ban" ? "banned" : "unbanned" })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    // Same deletion path as /admin/clients: the delete-user edge function
    // clears every table that references the account, then the auth user.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { error } = await supabaseAdmin.functions.invoke("delete-user", {
      body: { userId: finding.user_id },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
    // One account can have several findings — close them all.
    await supabaseAdmin
      .from("security_findings")
      .update({
        status: "resolved",
        action_taken: "deleted",
        resolved_at: new Date().toISOString(),
        resolved_by_email: admin.email,
      })
      .eq("user_id", finding.user_id)
      .eq("status", "open");
    await close("resolved", "deleted");
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
