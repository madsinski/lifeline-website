// Admin: the test-code pool (Heilsuferð → Prófunarkóðar).
//
// GET   → every code with its status and who used it
// POST  { count, scope, package_key?, single_use?, expires_at?, note? } → generate N codes
// PATCH { id, revoke: true } → revoke one
//
// Reads need any active staff; writes need an admin with MFA (adminGate) —
// a test code is a free purchase.
//
// Schema: supabase/migration-test-codes-straumur.sql. Redemption:
// src/lib/hc/test-codes.ts (checkout, subscribe, check-in add-on).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { CHECKIN_ADDON_TARGET, generateTestCode } from "@/lib/hc/test-codes";

export const runtime = "nodejs";

const SCOPES = ["purchase", "subscription", "any"] as const;

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const [{ data: codes, error }, { data: pkgs }] = await Promise.all([
    supabaseAdmin.from("hc_test_codes").select("*").order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("hc_packages").select("key, name, kind, price_isk").eq("active", true).order("sort"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const userIds = Array.from(new Set((codes ?? []).map((c) => c.used_by).filter(Boolean))) as string[];
  const emails: Record<string, string | null> = {};
  if (userIds.length) {
    const { data } = await supabaseAdmin.from("clients_decrypted").select("id, email").in("id", userIds);
    for (const c of data ?? []) emails[c.id as string] = (c.email as string | null) ?? null;
  }
  return NextResponse.json({
    codes: (codes ?? []).map((c) => ({ ...c, used_by_email: c.used_by ? emails[c.used_by] ?? null : null })),
    packages: [
      ...(pkgs ?? []).map((p) => ({ key: p.key, name: p.name, scope: p.kind === "subscription" ? "subscription" : "purchase" })),
      { key: CHECKIN_ADDON_TARGET, name: "Viðtal við lækni (viðbót við endurmat)", scope: "purchase" },
    ],
  });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const count = Math.floor(Number(b.count));
  if (!(count >= 1 && count <= 50)) return NextResponse.json({ error: "Fjöldi: 1–50." }, { status: 400 });
  const scope = SCOPES.includes(b.scope) ? b.scope as (typeof SCOPES)[number] : null;
  if (!scope) return NextResponse.json({ error: "Veldu til hvers kóðinn er." }, { status: 400 });
  const packageKey = typeof b.package_key === "string" && b.package_key ? b.package_key : null;
  if (packageKey && packageKey !== CHECKIN_ADDON_TARGET) {
    const { data: p } = await supabaseAdmin.from("hc_packages").select("kind").eq("key", packageKey).maybeSingle();
    if (!p) return NextResponse.json({ error: "Pakkinn fannst ekki." }, { status: 400 });
    const pScope = p.kind === "subscription" ? "subscription" : "purchase";
    if (scope !== "any" && scope !== pScope) return NextResponse.json({ error: "Pakkinn passar ekki við tegund kóðans." }, { status: 400 });
  }
  if (packageKey === CHECKIN_ADDON_TARGET && scope === "subscription") {
    return NextResponse.json({ error: "Pakkinn passar ekki við tegund kóðans." }, { status: 400 });
  }
  let expiresAt: string | null = null;
  if (b.expires_at) {
    const d = new Date(b.expires_at);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return NextResponse.json({ error: "Gildistíminn verður að vera í framtíðinni." }, { status: 400 });
    expiresAt = d.toISOString();
  }
  const rows = Array.from({ length: count }, () => ({
    code: generateTestCode(),
    scope,
    package_key: packageKey,
    single_use: b.single_use !== false,
    expires_at: expiresAt,
    note: typeof b.note === "string" ? b.note.trim().slice(0, 200) || null : null,
    created_by: g.id,
  }));
  const { data, error } = await supabaseAdmin.from("hc_test_codes").insert(rows).select("id, code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("hc_audit").insert({
    actor: `staff:${g.id}`, action: "test_codes_created", journey_id: null,
    detail: { count, scope, package_key: packageKey, single_use: b.single_use !== false, expires_at: expiresAt },
  }).then(() => {}, () => {});
  return NextResponse.json({ ok: true, codes: data });
}

export async function PATCH(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string" || b.revoke !== true) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("hc_test_codes")
    .update({ revoked_at: new Date().toISOString(), revoked_by: g.id })
    .eq("id", b.id).is("revoked_at", null).select("id, code").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Kóðinn fannst ekki eða er þegar afturkallaður." }, { status: 404 });
  await supabaseAdmin.from("hc_audit").insert({ actor: `staff:${g.id}`, action: "test_code_revoked", journey_id: null, detail: { id: b.id } })
    .then(() => {}, () => {});
  return NextResponse.json({ ok: true });
}
