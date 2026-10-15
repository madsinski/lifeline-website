import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { SIGNUP_TERMS_VERSION } from "@/lib/signup-consent";
import {
  PUBLIC_PRIVACY_VERSION,
  PUBLIC_TERMS_VERSION,
  renderPublicPrivacyPolicy,
  renderPublicTermsOfService,
} from "@/lib/public-pages-content";

// POST /api/account/signup-consent
//
// Copies what the person accepted at signup (/byrja) from their auth
// user_metadata onto their clients row: terms_version, terms_accepted_at,
// research_opt_out, marketing_opt_out. Called on the first authenticated
// load (login page, /app via ensureSignupConsentRecorded in
// src/lib/signup-consent.ts).
//
// Why server side: with email confirmation on, signUp() returns no session,
// so the browser cannot write clients_decrypted at signup time — the old
// browser insert failed silently and the ToS record + opt-outs were lost.
//
// Idempotent: if the clients row already has terms_accepted_at, nothing is
// overwritten (later changes to opt-outs in settings are never clobbered).
// terms_accepted_at is the auth user's created_at — the server's own record
// of the moment the signUp() carrying the acceptance happened — not the time
// of this call.
//
// Also writes platform_agreement_acceptances rows for the public ToS and
// privacy policy (text hash + IP + UA of this first authenticated request),
// mirroring the B2B onboard complete route. Best effort.

export const runtime = "nodejs";

const PUBLIC_TOS_KEY = "public-terms-of-service";
const PUBLIC_PRIVACY_KEY = "public-privacy-policy";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  // Metadata is user-writable: use it only as a presence check. The version
  // recorded is the server's own constant, never the echoed metadata value.
  const accepted = typeof meta.terms_version === "string" && !!meta.terms_version.trim();
  if (!accepted) {
    return NextResponse.json({ ok: true, recorded: false, reason: "no_signup_consent" });
  }

  const now = new Date().toISOString();
  const acceptedAt = user.created_at || now;
  const markDone = async () => {
    if (meta.signup_consent_recorded_at) return;
    await supabaseAdmin.auth.admin
      .updateUserById(user.id, { user_metadata: { ...meta, signup_consent_recorded_at: now } })
      .catch((e: unknown) => console.error("[signup-consent] metadata flag:", (e as Error).message));
  };

  const { data: row, error: selErr } = await supabaseAdmin
    .from("clients_decrypted")
    .select("id, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (selErr) {
    console.error("[signup-consent] select:", selErr.message);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (row?.terms_accepted_at) {
    await markDone();
    return NextResponse.json({ ok: true, recorded: false, reason: "already_recorded" });
  }

  const fields = {
    terms_accepted_at: acceptedAt,
    terms_version: SIGNUP_TERMS_VERSION,
    research_opt_out: meta.research_opt_out === true,
    marketing_opt_out: meta.marketing_opt_out === true,
    updated_at: now,
  };

  if (row) {
    const { error } = await supabaseAdmin.from("clients_decrypted").update(fields).eq("id", user.id);
    if (error) {
      console.error("[signup-consent] update:", error.message);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
  } else {
    // handle_new_user() normally creates the row; this covers the gap.
    const email = user.email || "";
    const fullName = typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name.trim()
      : email.split("@")[0];
    const { error } = await supabaseAdmin.from("clients_decrypted").insert({
      id: user.id, email, full_name: fullName, created_at: acceptedAt, ...fields,
    });
    if (error) {
      console.error("[signup-consent] insert:", error.message);
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }
  }

  // Audit rows for the two documents, with IP + UA (best effort).
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
    const ua = req.headers.get("user-agent") || null;
    const docs = [
      { key: PUBLIC_TOS_KEY, version: PUBLIC_TERMS_VERSION, text: renderPublicTermsOfService("is") },
      { key: PUBLIC_PRIVACY_KEY, version: PUBLIC_PRIVACY_VERSION, text: renderPublicPrivacyPolicy("is") },
    ];
    await Promise.all(docs.map(async (d) => {
      const { data: existing } = await supabaseAdmin
        .from("platform_agreement_acceptances")
        .select("id")
        .eq("user_id", user.id)
        .eq("document_key", d.key)
        .eq("document_version", d.version)
        .maybeSingle();
      if (existing) return;
      const { error } = await supabaseAdmin.from("platform_agreement_acceptances").insert({
        user_id: user.id,
        document_key: d.key,
        document_version: d.version,
        text_hash: sha256(d.text),
        ip,
        user_agent: ua,
      });
      if (error) console.error(`[signup-consent] acceptance ${d.key}:`, error.message);
    }));
  } catch (e) {
    console.error("[signup-consent] acceptance block:", (e as Error).message);
  }

  await markDone();
  return NextResponse.json({ ok: true, recorded: true });
}
