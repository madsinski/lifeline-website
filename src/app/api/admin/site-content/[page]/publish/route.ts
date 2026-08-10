// Publish a page: copy `draft` → `published`. Admin + AAL2. Until this runs, the
// public site keeps rendering the previously-published content (or the built-in
// defaults if nothing has ever been published).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminAAL2 } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ page: string }> }) {
  const auth = await requireAdminAAL2(req);
  if (typeof auth === "string") {
    return NextResponse.json({ ok: false, error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const { page } = await ctx.params;

  const { data: row } = await supabaseAdmin.from("site_content").select("draft").eq("page", page).maybeSingle();
  if (!row) return NextResponse.json({ ok: false, error: "Ekkert efni til að birta" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("site_content")
    .update({ published: row.draft, published_at: new Date().toISOString(), updated_by: auth.id })
    .eq("page", page)
    .select("page, published_at")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, published_at: data.published_at });
}
