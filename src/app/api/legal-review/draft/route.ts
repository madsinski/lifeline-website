// Token-gated draft (redline) save for external counsel — NO login.
//
// The lawyer opens /legal-review/<token>, identifies by name + email,
// and pastes a revised version of a document. This inserts a row in
// legal_document_drafts attributed to that name/email (edited_via='link')
// so the admin page and the link both immediately show the new text.
//
// Auth: the token IS the credential. Validated server-side against
// legal_review_links. See supabase/migration-legal-review-links.sql.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateReviewToken, touchReviewLink } from "@/lib/legal-review-token";

export const runtime = "nodejs";

interface Body {
  token?: string;
  name?: string;
  email?: string;
  document_key?: string;
  language?: "is" | "en";
  proposed_version?: string;
  text?: string;
  source_note?: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Body = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const link = await validateReviewToken(body.token);
  if (!link) return NextResponse.json({ ok: false, error: "Invalid or expired review link" }, { status: 403 });

  const name = (body.name || "").toString().trim().slice(0, 200);
  const email = (body.email || "").toString().trim().slice(0, 200);
  if (!name || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Your name and a valid email are required" }, { status: 400 });
  }

  const document_key = (body.document_key || "").trim();
  const language = body.language;
  const proposed_version = (body.proposed_version || "").trim();
  const text = (body.text || "").toString();
  const source_note = (body.source_note || "").toString().slice(0, 500) || null;

  if (!document_key) return NextResponse.json({ ok: false, error: "document_key required" }, { status: 400 });
  if (language !== "is" && language !== "en") return NextResponse.json({ ok: false, error: "language must be 'is' or 'en'" }, { status: 400 });
  if (!proposed_version) return NextResponse.json({ ok: false, error: "proposed_version required" }, { status: 400 });
  if (text.length < 20) return NextResponse.json({ ok: false, error: "text is too short — looks like a paste error" }, { status: 400 });
  if (text.length > 200_000) return NextResponse.json({ ok: false, error: "text exceeds 200KB — split into sections if needed" }, { status: 400 });

  const { data: insertRow, error: insErr } = await supabaseAdmin
    .from("legal_document_drafts")
    .insert({
      document_key,
      language,
      proposed_version,
      text,
      text_hash: sha256Hex(text),
      edited_by: null,
      edited_by_email: email,
      edited_by_name: name,
      edited_via: "link",
      review_link_id: link.id,
      source_note,
    })
    .select("id, created_at, text_hash, proposed_version")
    .single();

  if (insErr || !insertRow) {
    return NextResponse.json({ ok: false, error: `Could not save draft: ${insErr?.message}` }, { status: 500 });
  }

  await touchReviewLink(link.id);
  return NextResponse.json({ ok: true, id: insertRow.id, created_at: insertRow.created_at });
}
