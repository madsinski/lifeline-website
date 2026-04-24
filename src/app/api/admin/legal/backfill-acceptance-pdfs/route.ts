import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { renderAcceptancePdf } from "@/lib/pdf-acceptance-renderer";
import {
  TOS_KEY, TOS_VERSION, renderTermsOfService,
  DPA_KEY, DPA_VERSION, renderDataProcessingAgreement,
  EMPLOYEE_TOS_KEY, EMPLOYEE_TOS_VERSION, renderEmployeeTermsOfService,
  HEALTH_CONSENT_KEY, HEALTH_CONSENT_VERSION, renderHealthAssessmentConsent,
} from "@/lib/platform-terms-content";

// Regenerate missing PDF certificates for platform_agreement_acceptances
// rows where the upload originally failed (bucket didn't exist). Safe to
// call repeatedly — only touches rows where pdf_storage_path is NULL.
// Admin only.

export const maxDuration = 300;

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

// Document templates by key+version. We only know how to render docs
// whose text we still have in the current codebase. Historical versions
// (e.g. TOS v0.9 before the rewrite) can't be regenerated here — they
// need a different strategy (preserved source string or manual PDF).
type DocMeta = { title: string; text: string };
function resolveDoc(key: string, version: string): DocMeta | null {
  if (key === TOS_KEY && version === TOS_VERSION) return { title: "Notkunarskilmálar", text: renderTermsOfService() };
  if (key === DPA_KEY && version === DPA_VERSION) return { title: "Gagnavinnslusamningur (DPA)", text: renderDataProcessingAgreement() };
  if (key === EMPLOYEE_TOS_KEY && version === EMPLOYEE_TOS_VERSION) return { title: "Notkunarskilmálar fyrir starfsmenn", text: renderEmployeeTermsOfService() };
  if (key === HEALTH_CONSENT_KEY && version === HEALTH_CONSENT_VERSION) return { title: "Samþykki fyrir heilsumati", text: renderHealthAssessmentConsent() };
  return null;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Pull every row that's missing its PDF. In practice there won't be
  // thousands of these; cap at 500 to keep the request sane.
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("platform_agreement_acceptances")
    .select("id, user_id, document_key, document_version, text_hash, ip, user_agent, accepted_at")
    .is("pdf_storage_path", null)
    .order("accepted_at", { ascending: true })
    .limit(500);
  if (selErr) return NextResponse.json({ error: "query_failed", detail: selErr.message }, { status: 500 });

  type Result = { id: string; status: "regenerated" | "skipped_version_not_found" | "skipped_text_hash_mismatch" | "failed"; error?: string };
  const results: Result[] = [];

  for (const r of rows || []) {
    try {
      const doc = resolveDoc(r.document_key, r.document_version);
      if (!doc) {
        results.push({ id: r.id, status: "skipped_version_not_found" });
        continue;
      }
      // Guard: we should only regenerate a PDF when the text we still
      // have produces the same hash that was signed. If the text has
      // drifted without a version bump, the hash mismatches and we
      // refuse to generate a misleading certificate.
      const currentHash = sha256(doc.text);
      if (currentHash !== r.text_hash) {
        results.push({ id: r.id, status: "skipped_text_hash_mismatch" });
        continue;
      }

      // Resolve signer email — best effort via clients, falls back to auth.
      let signerEmail: string | null = null;
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("email")
        .eq("id", r.user_id)
        .maybeSingle();
      signerEmail = (client as { email?: string | null } | null)?.email || null;
      if (!signerEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        signerEmail = authUser?.user?.email || null;
      }

      const pdfBytes = await renderAcceptancePdf({
        userEmail: signerEmail || "(unknown)",
        userId: r.user_id,
        documentKey: r.document_key,
        documentTitle: doc.title,
        documentVersion: r.document_version,
        documentText: doc.text,
        textHash: r.text_hash,
        ip: r.ip,
        userAgent: r.user_agent,
        acceptedAt: r.accepted_at,
      });

      const storagePath = `${r.user_id}/${r.id}.pdf`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("platform-acceptance-pdfs")
        .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (upErr) {
        console.error("[backfill] storage upload failed", r.id, upErr);
        results.push({ id: r.id, status: "failed", error: `upload: ${upErr.message}` });
        continue;
      }

      const { error: updErr } = await supabaseAdmin
        .from("platform_agreement_acceptances")
        .update({ pdf_storage_path: storagePath, pdf_sha256: sha256(pdfBytes) })
        .eq("id", r.id);
      if (updErr) {
        console.error("[backfill] row update failed", r.id, updErr);
        results.push({ id: r.id, status: "failed", error: `update: ${updErr.message}` });
        continue;
      }
      results.push({ id: r.id, status: "regenerated" });
    } catch (e) {
      console.error("[backfill] exception for", r.id, e);
      results.push({ id: r.id, status: "failed", error: `exception: ${(e as Error).message}` });
    }
  }

  const counts = {
    scanned: (rows || []).length,
    regenerated: results.filter((x) => x.status === "regenerated").length,
    skipped_version_not_found: results.filter((x) => x.status === "skipped_version_not_found").length,
    skipped_text_hash_mismatch: results.filter((x) => x.status === "skipped_text_hash_mismatch").length,
    failed: results.filter((x) => x.status === "failed").length,
  };
  return NextResponse.json({ ok: true, counts, results });
}
