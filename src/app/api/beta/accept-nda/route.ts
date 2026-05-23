import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { sendEmail } from "@/lib/email";
import {
  BETA_NDA_KEY,
  BETA_NDA_VERSION,
  renderBetaNda,
} from "@/lib/beta-nda-content";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";
import { withErrorReporting } from "@/lib/with-error-reporting";

export const runtime = "nodejs";
export const maxDuration = 30;

const DOCUMENT_TITLE = "Lifeline Beta Tester Agreement";

interface AcceptPayload {
  document_key?: string;        // expected: BETA_NDA_KEY
  document_version?: string;    // expected: BETA_NDA_VERSION
  typed_signature?: string;     // user's full legal name as typed
  app_platform?: string;        // 'ios' | 'android'
  app_version?: string;         // e.g. '0.1.0'
}

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export const POST = withErrorReporting(async (req: NextRequest) => {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body: AcceptPayload = await req.json().catch(() => ({} as AcceptPayload));
  const documentKey = body.document_key ?? BETA_NDA_KEY;
  const documentVersion = body.document_version ?? BETA_NDA_VERSION;
  const typedSignature = (body.typed_signature ?? "").trim();
  const appPlatform = body.app_platform ?? null;
  const appVersion = body.app_version ?? null;

  if (documentKey !== BETA_NDA_KEY || documentVersion !== BETA_NDA_VERSION) {
    return NextResponse.json({ error: "unknown_document_or_version" }, { status: 400 });
  }
  if (typedSignature.length < 3) {
    return NextResponse.json({ error: "typed_signature_required" }, { status: 400 });
  }

  // Server-rendered canonical text — never trust the client to pass
  // the text it claims to have signed.
  const canonicalText = renderBetaNda();
  const textHash = sha256Hex(canonicalText);
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const userEmail = user.email ?? "";

  // Idempotent: same (user, key, version) returns the existing row.
  const { data: existing } = await supabaseAdmin
    .from("beta_nda_acceptances")
    .select("id, accepted_at, pdf_storage_path")
    .eq("user_id", user.id)
    .eq("document_key", documentKey)
    .eq("document_version", documentVersion)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      id: existing.id,
      accepted_at: existing.accepted_at,
      pdf_storage_path: existing.pdf_storage_path,
      existing: true,
    });
  }

  const { data, error: insErr } = await supabaseAdmin
    .from("beta_nda_acceptances")
    .insert({
      user_id: user.id,
      user_email: userEmail || null,
      document_key: documentKey,
      document_version: documentVersion,
      text_hash: textHash,
      typed_signature: typedSignature,
      ip,
      user_agent: ua,
      app_platform: appPlatform,
      app_version: appVersion,
    })
    .select("id, accepted_at")
    .single();
  if (insErr) {
    return NextResponse.json({ error: "insert_failed", detail: insErr.message }, { status: 500 });
  }

  // ─── Generate + store the audit PDF, email the user a copy. ───
  let pdfStoragePath: string | null = null;
  try {
    const pdfBytes = await renderAcceptancePdf({
      userEmail: userEmail || "—",
      userId: user.id,
      documentKey,
      documentTitle: DOCUMENT_TITLE,
      documentVersion,
      documentText: canonicalText,
      textHash,
      ip,
      userAgent: ua,
      acceptedAt: data.accepted_at,
    });
    const pdfHash = sha256Hex(pdfBytes);

    pdfStoragePath = `${user.id}/${data.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("beta-nda-pdfs")
      .upload(pdfStoragePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (upErr) {
      console.error("[accept-nda] PDF upload failed:", upErr.message);
      pdfStoragePath = null;
    } else {
      await supabaseAdmin
        .from("beta_nda_acceptances")
        .update({ pdf_storage_path: pdfStoragePath, pdf_sha256: pdfHash })
        .eq("id", data.id);

      if (userEmail) {
        try {
          const subject = `Your signed Lifeline beta agreement (v${documentVersion})`;
          const html = `
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:32px 0;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:28px;">
    <h2 style="margin:0 0 8px;color:#111827;">Thanks for joining the beta.</h2>
    <p style="margin:0 0 16px;color:#4b5563;">
      Attached is a PDF copy of the <strong>${DOCUMENT_TITLE}</strong> (v${documentVersion}) you just signed inside the app, along with a one-page audit trail (timestamp, IP, document hash) for your records.
    </p>
    <p style="margin:0 0 8px;color:#4b5563;">A copy is also kept in the Lifeline system.</p>
    <p style="margin:18px 0 0;color:#9ca3af;font-size:12px;">Lifeline Health ehf. · kt. 590925-1440</p>
  </div>
</body></html>`;
          await sendEmail({
            to: userEmail,
            bcc: ["contact@lifelinehealth.is"],
            subject,
            html,
            text: `Thanks for joining the beta. Attached is your signed ${DOCUMENT_TITLE} (v${documentVersion}).`,
            attachments: [{
              filename: `lifeline-beta-nda-${documentVersion}.pdf`,
              content: pdfBytes.toString("base64"),
              contentType: "application/pdf",
            }],
          });
        } catch (e) {
          console.error("[accept-nda] email failed:", (e as Error).message);
        }
      }
    }
  } catch (e) {
    console.error("[accept-nda] PDF render failed:", (e as Error).message);
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    accepted_at: data.accepted_at,
    existing: false,
    pdf_storage_path: pdfStoragePath,
  });
}, { route: "POST /api/beta/accept-nda" });

// GET: returns whether the current user has accepted the current
// version. Used by the RN modal so existing testers don't see the
// signature step again after a fresh install.
export const GET = withErrorReporting(async (req: NextRequest) => {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("beta_nda_acceptances")
    .select("id, document_key, document_version, accepted_at, pdf_storage_path, revoked_at")
    .eq("user_id", user.id)
    .eq("document_key", BETA_NDA_KEY)
    .eq("document_version", BETA_NDA_VERSION)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    accepted: !!data && !data.revoked_at,
    acceptance: data ?? null,
    current_version: BETA_NDA_VERSION,
  });
}, { route: "GET /api/beta/accept-nda" });
