import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Public claim endpoint for shareable access-invite tokens.
//   GET /access/claim?t=<raw-token>
// On success, sets the site_access_token cookie (the raw token; the
// proxy hashes it on each request and looks it up via
// validate_access_token) and redirects to the home page.
//
// We keep the raw token in the cookie rather than minting an HMAC'd
// JWT so that revocation works instantly — turning off the row in
// access_invite_tokens immediately invalidates every browser holding
// that cookie.
const COOKIE_NAME = "site_access_token";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("t") || "").trim();
  if (!raw) return NextResponse.redirect(new URL("/access/error?reason=missing", req.url));

  const { data: rows } = await supabaseAdmin.rpc("claim_access_token", {
    p_token_hash: sha256Hex(raw),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;

  if (!row?.ok) {
    const reason = row?.error || "invalid";
    return NextResponse.redirect(new URL(`/access/error?reason=${encodeURIComponent(reason)}`, req.url));
  }

  // 90-day cookie — tied to the token row in DB, so revocation is
  // immediate; the long expiry is just so the reviewer doesn't have
  // to re-click their link every visit.
  const resp = NextResponse.redirect(new URL("/", req.url));
  resp.cookies.set(COOKIE_NAME, raw, {
    maxAge: 60 * 60 * 24 * 90,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return resp;
}
