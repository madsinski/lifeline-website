// Uppflettirit management for /admin/knowledge.
// GET → every row (incl. inactive)   POST → upsert by slug   DELETE ?slug=
// Schema: supabase/migration-hc-knowledge.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import type { KnowledgeBand } from "@/lib/hc/knowledge";

export const runtime = "nodejs";

const CATEGORIES = ["blood", "body", "mental", "lifestyle", "score", "method"];
const TONES = ["good", "watch", "high", "low"];

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const list = (v: unknown, n: number, max: number): string[] =>
  (Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => s(x, max)).filter((x): x is string => !!x).slice(0, n);
const num = (v: unknown): number | null => (v === null || v === "" || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

const slugify = (v: string) =>
  v.toLowerCase().replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ð/g, "d").replace(/ö/g, "o")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function bands(v: unknown): KnowledgeBand[] {
  return (Array.isArray(v) ? v : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b) => ({
      label: s(b.label, 60) || "",
      tone: (TONES.includes(b.tone as string) ? b.tone : "good") as KnowledgeBand["tone"],
      min: num(b.min),
      max: num(b.max),
      sex: (b.sex === "m" || b.sex === "f" ? b.sex : null) as KnowledgeBand["sex"],
      note: s(b.note, 300),
    }))
    .filter((b) => b.label)
    .slice(0, 12);
}

export async function GET(req: NextRequest) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const { data, error } = await supabaseAdmin.from("hc_knowledge").select("*").order("category").order("sort");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const title = s(b.title, 200);
  if (!title) return NextResponse.json({ error: "Heiti vantar." }, { status: 400 });
  const summary = s(b.summary, 600);
  if (!summary) return NextResponse.json({ error: "Stutt svar vantar." }, { status: 400 });
  const category = CATEGORIES.includes(b.category as string) ? (b.category as string) : "method";
  const row = {
    slug: s(b.slug, 60) || slugify(title),
    category, title, summary,
    aliases: list(b.aliases, 20, 60),
    unit: s(b.unit, 30),
    body_md: s(b.body_md, 6000),
    bands: bands(b.bands),
    higher_better: typeof b.higher_better === "boolean" ? b.higher_better : null,
    sources: list(b.sources, 10, 300),
    tags: list(b.tags, 12, 40),
    sort: Number(b.sort) || 100,
    active: b.active !== false,
    updated_at: new Date().toISOString(),
    updated_by: g.email ?? null,
  };
  const { data, error } = await supabaseAdmin.from("hc_knowledge").upsert(row, { onConflict: "slug" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: NextRequest) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  // Soft delete: the entry stops showing in the workstation but stays editable.
  const { error } = await supabaseAdmin.from("hc_knowledge").update({ active: false }).eq("slug", slug);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
