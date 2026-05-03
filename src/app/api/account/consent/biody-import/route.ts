// Biody-import consent — explicit grant/revoke endpoint.
//
// On grant: writes a row in client_consents, generates a signed PDF
// certificate (mirrors the staff acceptance pattern), uploads it to
// the private client-consent-pdfs bucket, and stores the path + sha
// back on the row. Email a copy to the user.
//
// On revoke: stamps revoked_at on the active row.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import {
  CLIENT_CONSENT_BIODY_IMPORT_KEY,
  CLIENT_CONSENT_BIODY_IMPORT_VERSION,
  renderClientConsentBiodyImport,
} from "@/lib/processor-agreements";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";

export const runtime = "nodejs";

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  let body: { action?: "grant" | "revoke" } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "grant" && action !== "revoke") {
    return NextResponse.json({ ok: false, error: "action must be grant or revoke" }, { status: 400 });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const user = userData.user;

  if (action === "revoke") {
    const { error } = await supabaseAdmin
      .from("client_consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", user.id)
      .eq("consent_key", CLIENT_CONSENT_BIODY_IMPORT_KEY)
      .is("revoked_at", null);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "revoke" });
  }

  // GRANT path
  const consentText = renderClientConsentBiodyImport();
  const textHash = sha256Hex(consentText);
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("client_consents")
    .insert({
      client_id: user.id,
      consent_key: CLIENT_CONSENT_BIODY_IMPORT_KEY,
      consent_version: CLIENT_CONSENT_BIODY_IMPORT_VERSION,
      text_hash: textHash,
      granted: true,
      ip,
      user_agent: userAgent,
    })
    .select("id, granted_at")
    .single();
  if (insErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: insErr?.message || "Could not record consent" },
      { status: 500 },
    );
  }

  // Render + upload PDF certificate.
  let pdfStoragePath: string | null = null;
  let pdfBytes: Buffer | null = null;
  try {
    pdfBytes = await renderAcceptancePdf({
      userEmail: user.email || "(unknown)",
      userId: user.id,
      documentKey: CLIENT_CONSENT_BIODY_IMPORT_KEY,
      documentTitle: "Samþykki fyrir birtingu líkamssamsetningar í Lifeline appi",
      documentVersion: CLIENT_CONSENT_BIODY_IMPORT_VERSION,
      documentText: consentText,
      textHash,
      ip,
      userAgent,
      acceptedAt: inserted.granted_at,
    });
    const storagePath = `${user.id}/${inserted.id}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("client-consent-pdfs")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
    if (!upErr) {
      pdfStoragePath = storagePath;
      await supabaseAdmin
        .from("client_consents")
        .update({ pdf_storage_path: storagePath, pdf_sha256: sha256Hex(pdfBytes) })
        .eq("id", inserted.id);
    }
  } catch {
    // PDF best-effort — the consent row is the source of truth either way.
  }

  // Email a copy to the user.
  if (user.email && pdfBytes) {
    try {
      await sendEmail({
        to: user.email,
        subject: "Staðfesting á samþykki — Biody innflutningur í Lifeline appi",
        html: `<p>Hæ,</p><p>Þú hefur samþykkt að líkamssamsetningarmælingar þínar úr Biody séu birtar í mælaborðinu þínu í Lifeline appinu. Meðfylgjandi er staðfesting með tímastimpli og rafrænni undirritun.</p><p>Þú getur afturkallað samþykkið hvenær sem er undir <em>Settings → Data &amp; privacy</em>.</p><p>— Lifeline Health</p>`,
        text: `Þú hefur samþykkt Biody innflutning í Lifeline appið. Meðfylgjandi staðfesting með tímastimpli.`,
        attachments: [
          {
            filename: `biody-consent-${CLIENT_CONSENT_BIODY_IMPORT_VERSION}.pdf`,
            content: pdfBytes.toString("base64"),
            contentType: "application/pdf",
          },
        ],
      });
    } catch {
      // Email best-effort.
    }
  }

  return NextResponse.json({
    ok: true,
    action: "grant",
    consentId: inserted.id,
    pdfStoragePath,
  });
}
