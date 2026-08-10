// Public: the PUBLISHED CMS blob for one marketing page. The public pages fetch
// this client-side (they are "use client" and resolve the locale from the i18n
// context). Drafts never appear here — only `published`, which is null until an
// admin has published at least once, in which case the page uses its built-in
// defaults. Reads via the service-role client (RLS blocks the anon client).

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ page: string }> }) {
  const { page } = await ctx.params;
  try {
    const { data } = await supabaseAdmin
      .from("site_content")
      .select("published, published_at")
      .eq("page", page)
      .maybeSingle();
    // The navbar config (order/visibility) should feel immediate after an
    // admin toggles it, so cache it briefly; page content changes less often.
    const cache = page === "nav"
      ? "public, s-maxage=5, stale-while-revalidate=20"
      : "public, s-maxage=60, stale-while-revalidate=300";
    return NextResponse.json(
      { published: data?.published ?? null, published_at: data?.published_at ?? null },
      { headers: { "Cache-Control": cache } },
    );
  } catch {
    return NextResponse.json({ published: null, published_at: null });
  }
}
