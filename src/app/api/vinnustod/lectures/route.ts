// Fræðsla for the workstation: published lectures with slides, so nurses can
// preview what a participant sees and attach lectures to a plan. Editing
// stays in /admin/lectures. Actor: workstation session or Lifeline staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("hc_lectures")
    .select("id, slug, title, subtitle, kind, video_url, slides, article_md, duration_min, pillar, is_welcome, sort, published")
    .eq("published", true).order("sort");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lectures: data || [], canEdit: actor.kind === "staff" });
}
