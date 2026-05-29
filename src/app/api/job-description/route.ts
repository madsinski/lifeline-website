// /api/job-description
//
// Multi-document store for recruiting job descriptions. Backs the admin
// editor (/admin/job-description) and the public read-only mirror
// (/verkefnalysing).
//
// GET                       — list all documents (admin only).
// GET ?id=<id>              — one document's fields + meta (admin).
// GET ?key=<viewKey>        — the default public-mirror document
//                             ('framkvaemdastjori') fields, for
//                             /verkefnalysing. Backward compatible.
// GET ?key=<viewKey>&id=<id>— a specific document for a public mirror.
// POST                      — create a new document (admin, AAL2).
// PUT  { id, ... }          — update a document (admin, AAL2). Without
//                             id, defaults to the legacy single doc.
// DELETE ?id=<id>           — delete a document (admin, AAL2). The
//                             legacy default doc cannot be deleted.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const DEFAULT_DOC_ID = "framkvaemdastjori";
const VIEW_KEY = "lifeline";

const META_COLS = "id, title, candidate_name, candidate_email, status, created_at, updated_at";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const id = req.nextUrl.searchParams.get("id");

  // Public-mirror path: shared view key. Returns a single document's
  // fields (default doc unless an explicit id is given).
  if (key === VIEW_KEY) {
    const docId = id || DEFAULT_DOC_ID;
    const { data, error } = await supabaseAdmin
      .from("job_descriptions")
      .select("title, fields, updated_at")
      .eq("id", docId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      title: data?.title ?? null,
      fields: (data?.fields as Record<string, unknown>) ?? {},
      updated_at: data?.updated_at ?? null,
    });
  }

  // Everything else is admin-only.
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Single document (with fields) when ?id= is given.
  if (id) {
    const { data, error } = await supabaseAdmin
      .from("job_descriptions")
      .select(`${META_COLS}, fields`)
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ document: data });
  }

  // Otherwise the list (meta only, newest first).
  const { data, error } = await supabaseAdmin
    .from("job_descriptions")
    .select(META_COLS)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }

  let body: { title?: string; candidate_name?: string; candidate_email?: string; fields?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const id = randomUUID();
  const { data, error } = await supabaseAdmin
    .from("job_descriptions")
    .insert({
      id,
      title: (body.title?.trim() || "Untitled"),
      candidate_name: body.candidate_name?.trim() || null,
      candidate_email: body.candidate_email?.trim()?.toLowerCase() || null,
      fields: body.fields && typeof body.fields === "object" && !Array.isArray(body.fields) ? body.fields : {},
      status: "draft",
      created_by: user.id,
      updated_by: user.id,
    })
    .select(META_COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }

  let body: {
    id?: string;
    fields?: Record<string, unknown>;
    title?: string;
    candidate_name?: string;
    candidate_email?: string;
    status?: string;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const id = body.id || DEFAULT_DOC_ID;

  // Build a partial update from whatever the caller sent.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user.id };
  if (body.fields && typeof body.fields === "object" && !Array.isArray(body.fields)) patch.fields = body.fields;
  if (typeof body.title === "string") patch.title = body.title.trim() || "Untitled";
  if (typeof body.candidate_name === "string") patch.candidate_name = body.candidate_name.trim() || null;
  if (typeof body.candidate_email === "string") patch.candidate_email = body.candidate_email.trim().toLowerCase() || null;
  if (typeof body.status === "string") patch.status = body.status;

  // Upsert keeps the legacy default doc working even if its row was
  // somehow removed; new docs are created via POST so id is supplied.
  const { data, error } = await supabaseAdmin
    .from("job_descriptions")
    .upsert({ id, ...patch }, { onConflict: "id" })
    .select(META_COLS)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  if (id === DEFAULT_DOC_ID) {
    return NextResponse.json({ error: "cannot_delete_default_document" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("job_descriptions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
