// Token-gated sign-off (approval / comment / request-changes / reject)
// for external counsel — NO login.
//
// The lawyer opens /legal-review/<token>, identifies by name + email,
// and acts on a (document_key, document_version). We persist the review
// state to legal_review_signoffs (reviewer_via='link', reviewer_email +
// reviewer_name captured), capture IP/UA + a sha256 of the exact text,
// and generate a signed PDF certificate on approval — non-repudiation
// evidence corroborating the asserted identity.
//
// Auth: the token IS the credential, validated against legal_review_links.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";
import { validateReviewToken, touchReviewLink } from "@/lib/legal-review-token";

export const runtime = "nodejs";

type Action = "comment" | "approve" | "request_changes" | "reject";
const ACTIONS: Action[] = ["comment", "approve", "request_changes", "reject"];

interface Body {
  token?: string;
  name?: string;
  email?: string;
  action?: string;
  document_key?: string;
  document_version?: string;
  document_title?: string;
  document_text?: string;
  comments?: string;
}

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function statusForAction(action: Action): string {
  switch (action) {
    case "approve": return "approved";
    case "request_changes": return "changes_requested";
    case "reject": return "rejected";
    case "comment": return "under_review";
  }
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

  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }
  if (!body.document_key || !body.document_version || !body.document_title || !body.document_text) {
    return NextResponse.json({ ok: false, error: "Missing document fields" }, { status: 400 });
  }
  const comments = (body.comments || "").toString().slice(0, 8000);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const textHash = sha256Hex(body.document_text);
  const status = statusForAction(action);
  const signedAt = action === "approve" ? new Date().toISOString() : null;

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("legal_review_signoffs")
    .insert({
      document_key: body.document_key,
      document_version: body.document_version,
      document_title: body.document_title,
      text_hash: textHash,
      status,
      comments: comments || null,
      reviewer_id: null,
      reviewer_name: name,
      reviewer_email: email,
      reviewer_via: "link",
      review_link_id: link.id,
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
    })
    .select("id, created_at, signed_at")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ ok: false, error: insErr?.message || "Could not record signoff" }, { status: 500 });
  }

  // Signed PDF certificate on approval (best-effort — the row already
  // carries text_hash + IP + UA + signed_at as cryptographic proof).
  let pdfStoragePath: string | null = null;
  if (action === "approve") {
    try {
      const pdfBytes = await renderAcceptancePdf({
        userEmail: email,
        userId: `link:${link.id}`,
        documentKey: body.document_key,
        documentTitle: body.document_title,
        documentVersion: body.document_version,
        documentText: body.document_text,
        textHash,
        ip,
        userAgent,
        acceptedAt: signedAt!,
      });
      const storagePath = `link/${link.id}/${inserted.id}.pdf`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("legal-signoff-pdfs")
        .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
      if (!upErr) {
        pdfStoragePath = storagePath;
        await supabaseAdmin
          .from("legal_review_signoffs")
          .update({ pdf_storage_path: storagePath, pdf_sha256: sha256Hex(pdfBytes) })
          .eq("id", inserted.id);
      }
    } catch {
      /* best-effort */
    }
  }

  await touchReviewLink(link.id);
  return NextResponse.json({ ok: true, id: inserted.id, status, signed_at: inserted.signed_at, pdf_storage_path: pdfStoragePath });
}
