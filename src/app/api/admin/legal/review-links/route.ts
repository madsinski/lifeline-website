// Admin management of no-login external-counsel review links.
//
// GET   — list links (active first). Admin read.
// POST  — mint a new link { label?, expires_in_days? }. Admin + AAL2.
// PATCH — revoke a link { id }. Admin + AAL2.
//
// The token is a 32-byte base64url secret placed in the URL at
// /legal-review/<token>. See supabase/migration-legal-review-links.sql.

import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// requireAdminAAL2 gives AAL2 + write-staff; minting/revoking a counsel
// link is further restricted to role='admin'. Returns the admin's
// staff row on success, or a NextResponse to return on failure.
async function requireAdmin(req: NextRequest) {
  const gate = await requireAdminAAL2(req);
  if (gate === "unauthorized") return { error: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }) };
  if (gate === "mfa_required") return { error: NextResponse.json({ ok: false, error: "MFA required" }, { status: 401 }) };
  if (gate === "forbidden") return { error: NextResponse.json({ ok: false, error: "Not authorised" }, { status: 403 }) };
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, email, role, active")
    .eq("id", gate.id)
    .maybeSingle();
  if (!staffRow || !staffRow.active || staffRow.role !== "admin") {
    return { error: NextResponse.json({ ok: false, error: "Admin role required" }, { status: 403 }) };
  }
  return { staff: staffRow };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  try {
    const { data, error } = await supabaseAdmin
      .from("legal_review_links")
      .select("id, token, label, active, expires_at, created_by_email, created_at, revoked_at, last_used_at")
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, links: data || [] });
  } catch (e) {
    // Table may not exist yet (migration not applied) — return empty so
    // the UI renders a "run the migration" hint instead of erroring.
    return NextResponse.json({ ok: true, links: [], migration_missing: true, error: (e as Error).message });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  let body: { label?: string; expires_in_days?: number } = {};
  try { body = await req.json(); } catch { /* empty body allowed */ }
  const label = (body.label || "").toString().slice(0, 200) || null;
  const days = Number.isFinite(body.expires_in_days) ? Math.max(0, Math.floor(body.expires_in_days as number)) : 30;
  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  const token = randomBytes(32).toString("base64url");

  const { data, error } = await supabaseAdmin
    .from("legal_review_links")
    .insert({
      token,
      label,
      expires_at: expiresAt,
      created_by: gate.staff.id,
      created_by_email: gate.staff.email,
    })
    .select("id, token, label, active, expires_at, created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message || "Could not create link" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, link: data });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  let body: { id?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  if (!body.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("legal_review_links")
    .update({ active: false, revoked_at: new Date().toISOString() })
    .eq("id", body.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
