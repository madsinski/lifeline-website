import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// Admin CRUD for company_documents — historic ToS / DPA / purchase-
// order PDFs for companies that signed offline. Stored in the
// 'company-docs' private bucket; reads via short-lived signed URLs.

export const maxDuration = 60;
const BUCKET = "company-docs";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB per file
const ALLOWED_KINDS = new Set(["tos", "dpa", "purchase_order", "other"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

// List all docs attached to a company, with freshly-signed download URLs.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: rows, error } = await supabaseAdmin
    .from("company_documents")
    .select("id, company_id, kind, title, filename, storage_path, content_type, size_bytes, signer_name, signed_at, note, uploaded_by, uploaded_at")
    .eq("company_id", companyId)
    .order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach a 10-minute signed URL per document so the admin can
  // download directly without another round-trip.
  const withUrls = await Promise.all(
    (rows || []).map(async (r) => {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_path, 600);
      return { ...r, signed_url: signed?.signedUrl || null };
    }),
  );

  return NextResponse.json({ ok: true, documents: withUrls });
}

// Upload a new document. Accepts multipart/form-data with fields:
//   file       — the PDF (required)
//   kind       — 'tos' | 'dpa' | 'purchase_order' | 'other'
//   title      — optional human label
//   signer_name, signed_at (YYYY-MM-DD), note — optional metadata
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "expected_multipart" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "").trim();
  const title = String(form.get("title") || "").trim() || null;
  const signerName = String(form.get("signer_name") || "").trim() || null;
  const signedAt = String(form.get("signed_at") || "").trim() || null;
  const note = String(form.get("note") || "").trim() || null;

  if (!(file instanceof File)) return NextResponse.json({ error: "file_missing" }, { status: 400 });
  if (!ALLOWED_KINDS.has(kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large", detail: "max 25 MB" }, { status: 413 });
  if (!ALLOWED_MIME.has(file.type)) return NextResponse.json({ error: "invalid_mime", detail: `Got ${file.type}, expected PDF or image.` }, { status: 400 });
  if (signedAt && !/^\d{4}-\d{2}-\d{2}$/.test(signedAt)) {
    return NextResponse.json({ error: "signed_at_format", detail: "YYYY-MM-DD" }, { status: 400 });
  }

  // Confirm the company exists.
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return NextResponse.json({ error: "company_not_found" }, { status: 404 });

  // Upload. Storage path: companyId/kind/<uuid>-<safe-filename>.
  const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const id = crypto.randomUUID();
  const storagePath = `${companyId}/${kind}/${id}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: "upload_failed", detail: upErr.message }, { status: 500 });
  }

  const { data: row, error: insErr } = await supabaseAdmin
    .from("company_documents")
    .insert({
      id,
      company_id: companyId,
      kind,
      title,
      filename: safeName,
      storage_path: storagePath,
      content_type: file.type,
      size_bytes: file.size,
      signer_name: signerName,
      signed_at: signedAt,
      note,
      uploaded_by: user.id,
    })
    .select("id, kind, title, filename, storage_path, content_type, size_bytes, signer_name, signed_at, note, uploaded_at")
    .single();
  if (insErr) {
    // Best-effort: delete the uploaded blob so we don't orphan files.
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return NextResponse.json({ error: "db_insert_failed", detail: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document: row });
}
