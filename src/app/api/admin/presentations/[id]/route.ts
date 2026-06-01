import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PresentationData, Slide } from "@/lib/presentations/types";

// Backed by supabase/migration-presentations.sql

type Ctx = { params: Promise<{ id: string }> };

function isValidData(d: unknown): d is PresentationData {
  if (!d || typeof d !== "object") return false;
  const slides = (d as { slides?: unknown }).slides;
  if (!Array.isArray(slides)) return false;
  return slides.every((s) => s && typeof s === "object" && typeof (s as Slide).id === "string" && typeof (s as Slide).type === "string");
}

// GET /api/admin/presentations/:id — full row (any active staff).
export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { data, error } = await supabaseAdmin
    .from("presentations")
    .select("id, slug, title, template_version, is_published, data, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ presentation: data });
}

// PUT /api/admin/presentations/:id — update title/data/publish (admin + AAL2).
export async function PUT(req: NextRequest, ctx: Ctx) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  const { id } = await ctx.params;

  let body: { title?: string; data?: unknown; is_published?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const patch: Record<string, unknown> = { updated_by: user.id };
  if (typeof body.title === "string") patch.title = body.title.trim() || "Untitled presentation";
  if (typeof body.is_published === "boolean") patch.is_published = body.is_published;
  if (body.data !== undefined) {
    if (!isValidData(body.data)) return NextResponse.json({ error: "invalid_data" }, { status: 400 });
    patch.data = body.data;
  }

  const { data, error } = await supabaseAdmin
    .from("presentations")
    .update(patch)
    .eq("id", id)
    .select("id, slug, title, template_version, is_published, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ presentation: data });
}

// DELETE /api/admin/presentations/:id (admin + AAL2).
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const user = await requireAdminAAL2(req);
  if (typeof user === "string") {
    return NextResponse.json({ error: user }, { status: user === "unauthorized" ? 401 : 403 });
  }
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin.from("presentations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
