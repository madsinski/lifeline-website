// POST /api/admin/payday/test-connection
//
// Staff-only diagnostic. Confirms which Payday environment the server
// is currently configured against and whether the env credentials can
// successfully mint an OAuth token from /auth/token.
//
// Used to verify a sandbox → production env switch before issuing a
// real invoice from the admin business page.
//
// Returns:
//   ok            — overall pass/fail
//   baseUrl       — current PAYDAY_BASE_URL (no secrets)
//   environment   — 'production' | 'sandbox' | 'unknown' (host-based heuristic)
//   clientIdSet   — whether PAYDAY_CLIENT_ID env is populated
//   clientSecretSet — whether PAYDAY_CLIENT_SECRET env is populated
//   tokenIssued   — whether /auth/token returned a usable bearer
//   clientIdPreview — first/last 4 chars of the client ID for sanity-check
//   httpStatus    — auth endpoint status if reached
//   error         — short string on failure (no body dump)

import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const BASE_URL = process.env.PAYDAY_BASE_URL || "https://api.payday.is";
const CLIENT_ID = process.env.PAYDAY_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYDAY_CLIENT_SECRET;

function environmentFromHost(url: string): "production" | "sandbox" | "unknown" {
  try {
    const host = new URL(url).host;
    if (host === "api.payday.is") return "production";
    if (host === "api.test.payday.is") return "sandbox";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function previewClientId(id?: string): string | null {
  if (!id) return null;
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const base = {
    baseUrl: BASE_URL,
    environment: environmentFromHost(BASE_URL),
    clientIdSet: !!CLIENT_ID,
    clientSecretSet: !!CLIENT_SECRET,
    clientIdPreview: previewClientId(CLIENT_ID),
  };

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({
      ...base,
      ok: false,
      tokenIssued: false,
      error: "Missing PAYDAY_CLIENT_ID or PAYDAY_CLIENT_SECRET",
    });
  }

  // Bypass the cached token — we want to actually exercise the
  // credentials against the configured base URL on each test click.
  try {
    const res = await fetch(`${BASE_URL}/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Version": "alpha",
      },
      body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    });
    const text = await res.text();
    let parsed: unknown = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* leave parsed null */ }
    const token = (parsed as any)?.access_token || (parsed as any)?.accessToken || (parsed as any)?.token;
    const ok = res.ok && !!token;

    return NextResponse.json({
      ...base,
      ok,
      tokenIssued: !!token,
      httpStatus: res.status,
      ...(ok ? {} : { error: text?.slice(0, 200) || `auth_http_${res.status}` }),
    });
  } catch (e) {
    return NextResponse.json({
      ...base,
      ok: false,
      tokenIssued: false,
      error: (e as Error).message,
    });
  }
}
