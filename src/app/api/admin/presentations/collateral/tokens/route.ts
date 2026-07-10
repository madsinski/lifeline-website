import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Mint / list / revoke unguessable external edit tokens for the print
// collateral. Backed by supabase/migration-collateral-edit-tokens.sql.
// Tokens are stored hashed (sha256); the plaintext is returned once at mint.

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// POST — mint a new token (admin + AAL2). Returns the plaintext token once.
export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  let body: { label?: string } = {};
  try { body = await req.json(); } catch { /* label optional */ }

  const token = randomBytes(24).toString("hex"); // 48 hex chars, unguessable
  const { error } = await supabaseAdmin
    .from("presentation_collateral_tokens")
    .insert({ token_hash: hash(token), label: body.label ?? null, created_by: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}

// GET — list active tokens (metadata only; never the plaintext).
export async function GET(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("presentation_collateral_tokens")
    .select("token_hash, label, created_at, revoked, last_used_at, expires_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] });
}

// DELETE ?hash=<token_hash> — revoke a token.
export async function DELETE(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  const tokenHash = new URL(req.url).searchParams.get("hash");
  if (!tokenHash) return NextResponse.json({ error: "missing_hash" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("presentation_collateral_tokens")
    .update({ revoked: true })
    .eq("token_hash", tokenHash);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
