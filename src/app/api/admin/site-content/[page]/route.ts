// Website CMS content for one page.
//   GET  — any active staff: returns { draft, published, updated_at, published_at }.
//   PUT  — admin + AAL2: replaces `draft` (autosave), upserts the row.
// See supabase/migration-site-content.sql.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isAnyActiveStaff, requireAdminAAL2 } from "@/lib/auth-helpers";
import { isValidContentKey } from "@/lib/site-content/registry";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ page: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAnyActiveStaff(user.id))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { page } = await ctx.params;

  const { data } = await supabaseAdmin
    .from("site_content")
    .select("page, draft, published, updated_at, published_at")
    .eq("page", page)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    content: data ?? { page, draft: {}, published: null, updated_at: null, published_at: null },
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ page: string }> }) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ ok: false, error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const { page } = await ctx.params;
  if (!isValidContentKey(page)) {
    return NextResponse.json({ ok: false, error: "unknown_page" }, { status: 400 });
  }

  let body: { draft?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.draft !== "object" || body.draft === null) {
    return NextResponse.json({ ok: false, error: "draft must be an object" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("site_content")
    .upsert(
      { page, draft: body.draft, updated_at: new Date().toISOString(), updated_by: auth.id },
      { onConflict: "page" },
    )
    .select("page, draft, published, updated_at, published_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, content: data });
}
