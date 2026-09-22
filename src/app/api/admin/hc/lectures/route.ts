// Lecture CMS (fræðsla): video, slide presentation or article.
// GET → all lectures (drafts included)   POST → create/update (upsert by id)
// DELETE ?id=
// Schema: supabase/migration-health-journey.sql (hc_lectures)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";

export const runtime = "nodejs";

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const [{ data: lectures }, { data: progress }] = await Promise.all([
    supabaseAdmin.from("hc_lectures").select("*").order("sort"),
    supabaseAdmin.from("hc_lecture_progress").select("lecture_id"),
  ]);
  const views: Record<string, number> = {};
  for (const p of progress || []) views[p.lecture_id] = (views[p.lecture_id] || 0) + 1;
  return NextResponse.json({ lectures: (lectures || []).map((l) => ({ ...l, completions: views[l.id] || 0 })) });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const title = s(b.title, 200);
  if (!title) return NextResponse.json({ error: "Titil vantar." }, { status: 400 });
  if (!["video", "slides", "article"].includes(b.kind)) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  const slug = (s(b.slug, 80) || title)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slides = (Array.isArray(b.slides) ? b.slides : [])
    .filter((x: unknown) => x && typeof x === "object")
    .slice(0, 60)
    .map((x: Record<string, unknown>) => ({ title: s(x.title, 200) || "", body: s(x.body, 4000) || "", image_url: s(x.image_url, 1000) }));
  const row = {
    slug,
    title,
    subtitle: s(b.subtitle, 300),
    kind: b.kind,
    video_url: s(b.video_url, 1000),
    slides,
    article_md: s(b.article_md, 60_000),
    duration_min: Number.isFinite(Number(b.duration_min)) && b.duration_min !== "" && b.duration_min !== null ? Math.round(Number(b.duration_min)) : null,
    pillar: ["sleep", "exercise", "nutrition", "mental", "general"].includes(b.pillar) ? b.pillar : null,
    is_welcome: !!b.is_welcome,
    sort: Number.isFinite(Number(b.sort)) ? Math.round(Number(b.sort)) : 0,
    published: !!b.published,
    updated_by: g.email ?? null,
    updated_at: new Date().toISOString(),
  };
  // Only one welcome lecture at a time.
  if (row.is_welcome) {
    await supabaseAdmin.from("hc_lectures").update({ is_welcome: false }).neq("id", b.id || "00000000-0000-0000-0000-000000000000");
  }
  const q = b.id
    ? supabaseAdmin.from("hc_lectures").update(row).eq("id", b.id).select("*").single()
    : supabaseAdmin.from("hc_lectures").insert(row).select("*").single();
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Slóðin (slug) er þegar í notkun." : error.message }, { status: 400 });
  return NextResponse.json({ lecture: data });
}

export async function DELETE(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("hc_lectures").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
