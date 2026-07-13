import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { DEFAULT_DOC, DEFAULT_SLUG } from "@/lib/station-instructions";

// Backed by supabase/migration-station-instructions.sql

// GET ?slug= — returns the saved doc, or the seed DEFAULT_DOC if none saved yet.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slug = new URL(req.url).searchParams.get("slug") || DEFAULT_SLUG;

  const { data } = await supabaseAdmin
    .from("station_instructions")
    .select("slug, title, doc, is_published, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (data && data.doc && (data.doc as { blocks?: unknown[] }).blocks) {
    return NextResponse.json({
      slug,
      title: data.title,
      doc: data.doc,
      is_published: data.is_published,
      updated_at: data.updated_at,
      exists: true,
    });
  }
  // Not saved yet — hand back the seed content so the editor opens populated.
  return NextResponse.json({
    slug,
    title: DEFAULT_DOC.title,
    doc: DEFAULT_DOC,
    is_published: false,
    exists: false,
  });
}

// PUT — save the doc (admin + AAL2).
export async function PUT(req: NextRequest) {
  const gate = await requireAdminAAL2(req);
  if (typeof gate === "string") {
    const status = gate === "mfa_required" ? 401 : gate === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: gate }, { status });
  }

  const body = await req.json().catch(() => ({}));
  const slug: string = body?.slug || DEFAULT_SLUG;
  const title: string = (body?.title || "").toString();
  const doc = body?.doc;
  const is_published = !!body?.is_published;
  if (!doc || !Array.isArray(doc.blocks)) {
    return NextResponse.json({ error: "invalid_doc" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("station_instructions")
    .upsert({
      slug,
      title,
      doc,
      is_published,
      updated_at: new Date().toISOString(),
      updated_by: gate.id,
    }, { onConflict: "slug" });

  if (error) {
    console.error("[station-instructions] upsert", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
