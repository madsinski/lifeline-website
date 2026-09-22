// One lecture for the account viewer, and marking it watched/read.
// GET → lecture + completed_at   POST { action: "complete" }
// Completing the welcome lecture ticks the journey's welcome step.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, patchJourney, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

async function load(slug: string) {
  const { data } = await supabaseAdmin.from("hc_lectures").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  return data;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const lecture = await load((await ctx.params).slug);
  if (!lecture) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [{ data: progress }, { data: all }] = await Promise.all([
    supabaseAdmin.from("hc_lecture_progress").select("completed_at").eq("client_id", user.id).eq("lecture_id", lecture.id).maybeSingle(),
    supabaseAdmin.from("hc_lectures").select("slug, title, sort").eq("published", true).order("sort"),
  ]);
  const idx = (all || []).findIndex((l) => l.slug === lecture.slug);
  return NextResponse.json({
    lecture,
    completed_at: progress?.completed_at ?? null,
    next: idx >= 0 ? (all || [])[idx + 1] ?? null : null,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const lecture = await load((await ctx.params).slug);
  if (!lecture) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await supabaseAdmin
    .from("hc_lecture_progress")
    .upsert({ client_id: user.id, lecture_id: lecture.id, completed_at: new Date().toISOString() }, { onConflict: "client_id,lecture_id" });
  if (lecture.is_welcome) {
    const j = await currentJourney(user.id);
    if (j && !j.welcome_seen_at) await patchJourney(j.id, { welcome_seen_at: new Date().toISOString() }, `client:${user.id}`, "welcome_seen");
  }
  return NextResponse.json({ ok: true });
}
