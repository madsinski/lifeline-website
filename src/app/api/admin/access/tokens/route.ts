import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// Mint a fresh site-access invite token. Returns the raw token + the
// claim URL ONCE — only the SHA-256 hash is stored, so it cannot be
// recovered after this response. The admin UI is responsible for
// showing/copying the URL immediately.
export async function POST(req: NextRequest) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const user = auth;

  const body = await req.json().catch(() => ({}));
  const label = (body?.label || "").trim() || null;
  const maxUses = body?.max_uses != null ? Number(body.max_uses) : null;
  const expiresAt = body?.expires_at ? new Date(body.expires_at).toISOString() : null;

  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return NextResponse.json({ error: "max_uses must be >= 1 or null" }, { status: 400 });
  }

  // 32-byte URL-safe random — base64url'd, gives ~43 chars of entropy.
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");

  const { data, error } = await supabaseAdmin
    .from("access_invite_tokens")
    .insert({
      token_hash: hash,
      label,
      max_uses: maxUses,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id, label, expires_at, max_uses, created_at")
    .single();
  if (error || !data) {
    console.error("[access/tokens] insert", error);
    return NextResponse.json({ error: "token_create_failed" }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "https://www.lifelinehealth.is";
  return NextResponse.json({
    ...data,
    token: raw,
    url: `${origin.replace(/\/$/, "")}/access/claim?t=${raw}`,
  });
}
