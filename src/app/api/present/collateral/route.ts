import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Public, token-gated save for the print collateral. No login: a valid
// unguessable edit token (minted by an admin, stored hashed) is the only
// authorisation. Backed by supabase/migration-collateral-edit-tokens.sql.

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function tokenIsValid(token: string): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const { data, error } = await supabaseAdmin
    .from("presentation_collateral_tokens")
    .select("revoked, expires_at")
    .eq("token_hash", hash(token))
    .maybeSingle();
  if (error || !data || data.revoked) return false;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return false;
  return true;
}

export async function POST(req: NextRequest) {
  let body: { token?: string; data?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const token = body.token ?? "";
  if (!(await tokenIsValid(token))) return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return NextResponse.json({ error: "invalid_data" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("presentation_collateral")
    .upsert({ id: 1, data: body.data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // best-effort usage stamp; ignore failures
  await supabaseAdmin
    .from("presentation_collateral_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hash(token));

  return NextResponse.json({ ok: true });
}
