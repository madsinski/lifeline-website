import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";

// List + upload bespoke staff documents (offer letter, amendment, tax
// form, etc.). Mirrors /api/admin/companies/[id]/documents.
// GET: staff can read their own; admin/manage_team can read anyone.
// POST: admin/manage_team only.

export const maxDuration = 60;

const ALLOWED_KINDS = ["nda", "confidentiality", "employment_contract", "offer_letter", "amendment", "tax_form", "other"] as const;

async function canManage(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("staff")
    .select("role, permissions, active")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.active && (data.role === "admin" || (Array.isArray(data.permissions) && (data.permissions as string[]).includes("manage_team")));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  const { staffId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const isOwner = user.id === staffId;
  const manage = await canManage(user.id);
  if (!isOwner && !manage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: rows, error } = await supabaseAdmin
    .from("staff_documents")
    .select("id, kind, title, filename, storage_path, content_type, size_bytes, signer_name, signed_at, note, uploaded_by, uploaded_at")
    .eq("staff_id", staffId)
    .order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: "query_failed", detail: error.message }, { status: 500 });

  const withUrls = await Promise.all(
    (rows || []).map(async (r) => {
      const { data } = await supabaseAdmin.storage
        .from("staff-documents")
        .createSignedUrl(r.storage_path, 300);
      return { ...r, signed_url: data?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({ ok: true, documents: withUrls });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  const { staffId } = await params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isStaff(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await canManage(user.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // FormData: file + kind + optional title/signer/signed_at/note.
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file_missing" }, { status: 400 });
  const kindRaw = (form.get("kind") || "").toString();
  if (!ALLOWED_KINDS.includes(kindRaw as typeof ALLOWED_KINDS[number])) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  const kind = kindRaw as typeof ALLOWED_KINDS[number];
  const title = (form.get("title") || "").toString().trim() || null;
  const signerName = (form.get("signer_name") || "").toString().trim() || null;
  const signedAt = (form.get("signed_at") || "").toString().trim() || null;
  const note = (form.get("note") || "").toString().trim() || null;

  // Sanity: ensure the staff_id exists before wasting storage on it.
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .maybeSingle();
  if (!staffRow) return NextResponse.json({ error: "staff_not_found" }, { status: 404 });

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const storagePath = `${staffId}/${crypto.randomUUID()}-${safeFilename}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("staff-documents")
    .upload(storagePath, fileBytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) {
    console.error("[staff-documents POST] upload failed", upErr);
    return NextResponse.json({ error: "upload_failed", detail: upErr.message }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("staff_documents")
    .insert({
      staff_id: staffId,
      kind,
      title,
      filename: file.name,
      storage_path: storagePath,
      content_type: file.type || null,
      size_bytes: file.size,
      signer_name: signerName,
      signed_at: signedAt,
      note,
      uploaded_by: user.id,
    })
    .select("id, uploaded_at")
    .single();
  if (insErr || !inserted) {
    // Try to clean up the orphan upload.
    await supabaseAdmin.storage.from("staff-documents").remove([storagePath]).catch(() => null);
    return NextResponse.json({ error: "insert_failed", detail: insErr?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted.id, uploaded_at: inserted.uploaded_at });
}
