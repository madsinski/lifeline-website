import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createHash } from "crypto";

// Next 16 proxy.ts always runs on Node — no runtime or matcher exports
// are allowed in this file. Exclusions are handled by the bypass list
// + static-asset regex below.

// Hard bypass list — these paths must always work regardless of access
// rules: auth flows, admin (gated by /admin/login + AAL2), account
// (employees sign in here), API routes, static assets, and the access
// claim flow itself.
const BYPASS_PREFIXES = [
  "/auth",
  "/admin",
  "/account",
  "/api",
  "/access",            // the /access/claim route
  "/research",
  "/survey",
  "/verkefnalysing",
  "/radningarsamningur",
  "/present",           // public shareable presentation decks
  "/_next",
  "/favicon",
];

const STATIC_EXT_RE = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|html|pdf|txt|woff|woff2|ttf)$/;

const COOKIE_NAME = "site_access_token";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Hard bypass for system routes + static assets.
  if (BYPASS_PREFIXES.some((p) => pathname.startsWith(p)) || STATIC_EXT_RE.test(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // 2. Unauthenticated bypass via claimed invite-token cookie.
  const tokenCookie = request.cookies.get(COOKIE_NAME)?.value;

  // We construct one Supabase client and reuse it for both the token
  // lookup and the user-grant lookup.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8";

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach((c) => response.cookies.set(c.name, c.value, c.options));
      },
    },
  });

  if (tokenCookie) {
    const { data: valid } = await supabase.rpc("validate_access_token", {
      p_token_hash: sha256Hex(tokenCookie),
    });
    if (valid === true) return response;
    // Stale/revoked cookie — clear it and continue to the auth check.
    response.cookies.delete(COOKIE_NAME);
  }

  // 3. Logged-in user check via has_site_access RPC. Skip the getUser
  //    network call entirely if there isn't a Supabase auth cookie on
  //    the request — anonymous visitors are the common case and don't
  //    need a round-trip to Supabase just to be sent to coming-soon.
  const hasSupabaseAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));

  if (hasSupabaseAuthCookie) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const { data: ok } = await supabase.rpc("has_site_access", { p_uid: user.id });
      if (ok === true) return response;
    }
  }

  // 4. Default: gate to coming-soon.
  return NextResponse.rewrite(new URL("/coming-soon", request.url));
}
