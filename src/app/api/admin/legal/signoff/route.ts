// External counsel sign-off endpoint.
// Lawyers POST one of: { action: 'comment' | 'approve' | 'request_changes' | 'reject' }
// against a (document_key, document_version) pair. We persist the
// review state, capture IP/UA, generate a PDF certificate on approval,
// and return the row id.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffAAL2, gateError } from "@/lib/auth-helpers";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";

export const runtime = "nodejs";

type Action = "comment" | "approve" | "request_changes" | "reject";
const ACTIONS: Action[] = ["comment", "approve", "request_changes", "reject"];

interface ReviewBody {
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

export async function POST(req: Request) {
  // External counsel (lawyer) OR an internal admin may sign off. Admins need
  // AAL2; lawyer is MFA-exempt by the documented policy in
  // src/app/admin/layout.tsx (only sees /admin/legal/*, zero patient data;
  // non-repudiation comes from session + IP + sha256 + PDF certificate).
  const user = await requireStaffAAL2(req, { roles: ["admin", "lawyer"], mfaExemptRoles: ["lawyer"] });
  if (typeof user === "string") return gateError(user);

  let body: ReviewBody = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  }
  if (!body.document_key || !body.document_version || !body.document_title || !body.document_text) {
    return NextResponse.json({ ok: false, error: "Missing document fields" }, { status: 400 });
  }
  const comments = (body.comments || "").toString().slice(0, 8000);

  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();

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
      reviewer_id: user.id,
      reviewer_name: staffRow?.name ?? null,
      signed_at: signedAt,
      ip,
      user_agent: userAgent,
    })
    .select("id, created_at, signed_at")
    .single();

  if (insErr || !inserted) {
    console.error("[legal/signoff] insert failed", insErr?.code);
    return NextResponse.json(
      { ok: false, error: "Ekki tókst að skrá yfirferðina." },
      { status: 500 },
    );
  }

  // Generate signed PDF certificate when approving.
  let pdfStoragePath: string | null = null;
  if (action === "approve") {
    try {
      const pdfBytes = await renderAcceptancePdf({
        userEmail: staffRow?.email || user.email || "(unknown)",
        userId: user.id,
        documentKey: body.document_key,
        documentTitle: body.document_title,
        documentVersion: body.document_version,
        documentText: body.document_text,
        textHash,
        ip,
        userAgent,
        acceptedAt: signedAt!,
      });
      const storagePath = `${user.id}/${inserted.id}.pdf`;
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
      // Best-effort. The signoff row is already persisted with cryptographic
      // proof (text_hash + IP + UA + signed_at). The PDF is convenience.
    }
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    status,
    signed_at: inserted.signed_at,
    pdf_storage_path: pdfStoragePath,
  });
}
