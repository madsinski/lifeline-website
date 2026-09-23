// The nurse's reference book (hc_knowledge), read by the workstation lookup.
// Small corpus, so the whole active set goes over at once and the search runs
// in the browser — instant, and it keeps working while a nurse types.
// Actor: workstation session or Lifeline staff (Bearer + AAL2).

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("hc_knowledge")
    .select("slug, category, title, aliases, unit, summary, body_md, bands, higher_better, sources, tags, sort")
    .eq("active", true)
    .order("sort")
    .order("title");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data || [] });
}
