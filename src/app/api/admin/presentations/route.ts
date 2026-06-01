import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildTemplateData, isKnownTemplate } from "@/lib/presentations/templates";
import type { PresentationData } from "@/lib/presentations/types";

// Backed by supabase/migration-presentations.sql

const META_COLS = "id, slug, title, template_version, is_published, created_at, updated_at";

function slugify(input: string): string {
  const base = (input || "presentation")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "presentation";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

// GET /api/admin/presentations — list (any active staff may read).
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data, error } = await supabaseAdmin
    .from("presentations")
    .select(META_COLS)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presentations: data ?? [] });
}

// POST /api/admin/presentations — create from a template or duplicate (admin + AAL2).
export async function POST(req: NextRequest) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }

  let body: { title?: string; templateId?: string; duplicateOf?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  let title = (body.title || "").trim();
  let templateVersion = body.templateId && isKnownTemplate(body.templateId) ? body.templateId : "standard-v2";
  let data: PresentationData;

  if (body.duplicateOf) {
    const { data: src, error: srcErr } = await supabaseAdmin
      .from("presentations")
      .select("title, template_version, data")
      .eq("id", body.duplicateOf)
      .maybeSingle();
    if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });
    if (!src) return NextResponse.json({ error: "source_not_found" }, { status: 404 });
    data = (src.data as PresentationData) ?? { slides: [] };
    templateVersion = src.template_version ?? templateVersion;
    if (!title) title = `Copy of ${src.title ?? "presentation"}`;
  } else {
    data = buildTemplateData(templateVersion);
    if (!title) title = templateVersion === "standard-v1" ? "Standard deck (v1)" : "Standard deck (v2)";
  }

  // Generate a unique slug; retry a couple of times on the off chance of a clash.
  let inserted = null;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
    const slug = slugify(title);
    const { data: row, error } = await supabaseAdmin
      .from("presentations")
      .insert({
        slug,
        title,
        template_version: templateVersion,
        data,
        is_published: false,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(META_COLS)
      .single();
    if (error) {
      lastErr = error.message;
      if (!/duplicate key|unique/i.test(error.message)) break;
      continue;
    }
    inserted = row;
  }
  if (!inserted) return NextResponse.json({ error: lastErr ?? "insert_failed" }, { status: 500 });
  return NextResponse.json({ presentation: inserted }, { status: 201 });
}
