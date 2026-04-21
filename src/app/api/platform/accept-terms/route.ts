import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import {
  TOS_KEY,
  TOS_VERSION,
  DPA_KEY,
  DPA_VERSION,
  renderTermsOfService,
  renderDataProcessingAgreement,
} from "@/lib/platform-terms-content";

export const runtime = "nodejs";

interface AcceptPayload {
  document_key: string;
  document_version: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: AcceptPayload = await req.json().catch(() => ({} as AcceptPayload));
  const { document_key, document_version } = body;
  if (!document_key || !document_version) {
    return NextResponse.json({ error: "document_key and document_version required" }, { status: 400 });
  }

  // Server is the source of truth for the document text. Re-render to get the
  // hash — prevents a client from pretending to have accepted a different
  // version than what we actually serve.
  let canonicalText: string | null = null;
  if (document_key === TOS_KEY && document_version === TOS_VERSION) {
    canonicalText = renderTermsOfService();
  } else if (document_key === DPA_KEY && document_version === DPA_VERSION) {
    canonicalText = renderDataProcessingAgreement();
  }
  if (!canonicalText) {
    return NextResponse.json({ error: "unknown_document_or_version" }, { status: 400 });
  }

  const textHash = sha256Hex(canonicalText);
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  // Upsert — if the user already accepted this exact (key, version) the
  // existing row stays. We do NOT overwrite the original accepted_at.
  const { data: existing } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .select("id, accepted_at")
    .eq("user_id", user.id)
    .eq("document_key", document_key)
    .eq("document_version", document_version)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, id: existing.id, accepted_at: existing.accepted_at, existing: true });
  }

  const { data, error: insErr } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .insert({
      user_id: user.id,
      document_key,
      document_version,
      text_hash: textHash,
      ip,
      user_agent: ua,
    })
    .select("id, accepted_at")
    .single();
  if (insErr) return NextResponse.json({ error: "insert_failed", detail: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id, accepted_at: data.accepted_at, existing: false });
}

// GET: list current user's acceptances (used by client to skip the step if
// they've already accepted the current versions).
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .select("document_key, document_version, accepted_at")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ acceptances: data ?? [] });
}
