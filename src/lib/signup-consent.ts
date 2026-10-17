// Signup consent: what the person ticked when they created their account,
// and the one call that makes sure it is on their clients row.
//
// Why this exists. With email confirmation on, supabase.auth.signUp() returns
// no session, so the browser cannot write to clients_decrypted (granted only
// to `authenticated`). The old login page tried anyway inside a catch {} —
// the ToS timestamp and both opt-outs were silently lost for every new
// account. Now the choices travel in the signUp() metadata, and the first
// authenticated load copies them server side (POST /api/account/signup-consent),
// idempotently.
//
// Client-safe: no supabase-admin here.

import { supabase } from "@/lib/supabase";
import { PUBLIC_PRIVACY_VERSION, PUBLIC_TERMS_VERSION } from "@/lib/public-pages-content";

/** The version string recorded on clients.terms_version for a B2C signup.
 *  Versioned together — when either public text changes both bump. */
export const SIGNUP_TERMS_VERSION = `tos-${PUBLIC_TERMS_VERSION}+priv-${PUBLIC_PRIVACY_VERSION}`;

/**
 * A same-origin path to continue to, or null.
 * Accepts "/x…" only — not "//host", not "/\host", not a full URL.
 * A query and a fragment are kept ("/app/adgangur#askrift"); router.push
 * handles both, and neither can change the origin once the path starts
 * with a single "/".
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  if (v.includes("\\")) return null;
  if (/^\/(%2f|%5c|%00)/i.test(v)) return null;
  if (/[\u0000-\u001f]/.test(v)) return null;
  return v;
}

/**
 * Where a new account lands after confirming its email: /account, with the
 * purchase intent (if any) carried as ?next= so /account can offer
 * „Halda áfram þar sem frá var horfið“. A #fragment is dropped: the
 * confirmation link puts its own tokens in the hash.
 */
export function accountLandingPath(next: string | null | undefined): string {
  const clean = safeNextPath(next)?.split("#")[0] || null;
  return clean ? `/account?next=${encodeURIComponent(clean)}` : "/account";
}

const doneKey =(uid: string) => `ll-signup-consent:${uid}`;

/**
 * Make sure the terms acceptance + opt-outs given at signup are on the
 * clients row. Safe to call on every authenticated page load: it skips
 * itself once done (per user metadata flag and per tab), and the server
 * route is idempotent. Never throws.
 */
export async function ensureSignupConsentRecorded(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;
    const meta = (session.user.user_metadata || {}) as Record<string, unknown>;
    // Nothing was accepted through the new signup (older account, B2B, …).
    if (typeof meta.terms_version !== "string" || !meta.terms_version) return;
    if (meta.signup_consent_recorded_at) return;
    try {
      if (window.sessionStorage.getItem(doneKey(session.user.id))) return;
    } catch { /* private mode */ }

    const r = await fetch("/api/account/signup-consent", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (r.ok) {
      try { window.sessionStorage.setItem(doneKey(session.user.id), "1"); } catch { /* private mode */ }
    }
  } catch {
    /* Best effort: the next load tries again. */
  }
}
