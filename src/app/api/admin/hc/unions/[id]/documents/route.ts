// Union documents: the rules (reglur sjóðsins) and the signed cooperation
// agreement. Private bucket `union-documents`; staff get 10-minute signed
// URLs.
// POST multipart { file, kind: rules|agreement|other, title?, signed_at?,
//                  signed_by_union?, signed_by_lifeline?, valid_from?, valid_until? }
// GET ?doc=<id> → { url }        DELETE ?doc=<id>

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { hcAudit } from "@/lib/hc/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "union-documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
]);

const dateOrNull = (v: FormDataEntryValue | null) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const textOrNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const unionId = (await ctx.params).id;
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "");
  if (!(file instanceof File)) return NextResponse.json({ error: "Skrá vantar." }, { status: 400 });
  if (!["rules", "agreement", "other"].includes(kind)) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Skráin er of stór (hámark 25 MB)." }, { status: 400 });
  const isDocx = file.name.toLowerCase().endsWith(".docx");
  if (!ALLOWED.has(file.type) && !isDocx) return NextResponse.json({ error: "Aðeins PDF, DOCX, TXT eða myndir." }, { status: 400 });

  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${unionId}/${kind}/${Date.now()}-${safe}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data, error } = await supabaseAdmin
    .from("hc_union_documents")
    .insert({
      union_id: unionId,
      kind,
      title: textOrNull(form.get("title")) || file.name,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || (isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : null),
      size_bytes: file.size,
      signed_at: dateOrNull(form.get("signed_at")),
      signed_by_union: textOrNull(form.get("signed_by_union")),
      signed_by_lifeline: textOrNull(form.get("signed_by_lifeline")),
      valid_from: dateOrNull(form.get("valid_from")),
      valid_until: dateOrNull(form.get("valid_until")),
      uploaded_by: g.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await hcAudit(`staff:${g.email}`, "union_document_uploaded", null, { union_id: unionId, kind, document_id: data.id });
  return NextResponse.json({ document: data });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const unionId = (await ctx.params).id;
  const docId = req.nextUrl.searchParams.get("doc");
  if (!docId) {
    const { data } = await supabaseAdmin.from("hc_union_documents").select("*").eq("union_id", unionId).order("created_at", { ascending: false });
    return NextResponse.json({ documents: data || [] });
  }
  const { data: doc } = await supabaseAdmin.from("hc_union_documents").select("storage_path").eq("id", docId).eq("union_id", unionId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 600);
  return NextResponse.json({ url: signed?.signedUrl ?? null });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const unionId = (await ctx.params).id;
  const b = await req.json().catch(() => ({}));
  if (!b.doc) return NextResponse.json({ error: "doc required" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  for (const k of ["signed_at", "valid_from", "valid_until"]) if (k in b) patch[k] = typeof b[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b[k]) ? b[k] : null;
  for (const k of ["title", "signed_by_union", "signed_by_lifeline"]) if (k in b) patch[k] = typeof b[k] === "string" && b[k].trim() ? b[k].trim() : null;
  const { data, error } = await supabaseAdmin.from("hc_union_documents").update(patch).eq("id", b.doc).eq("union_id", unionId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ document: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const unionId = (await ctx.params).id;
  const docId = req.nextUrl.searchParams.get("doc");
  const { data: doc } = await supabaseAdmin.from("hc_union_documents").select("id, storage_path, kind").eq("id", docId || "").eq("union_id", unionId).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await supabaseAdmin.storage.from(BUCKET).remove([doc.storage_path]);
  await supabaseAdmin.from("hc_union_documents").delete().eq("id", doc.id);
  await hcAudit(`staff:${g.email}`, "union_document_deleted", null, { union_id: unionId, kind: doc.kind });
  return NextResponse.json({ ok: true });
}
