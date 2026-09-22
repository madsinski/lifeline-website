// Action-plan library management for /admin/coach/plans.
// kind ∈ modules | templates | exercise | nutrition
// GET → rows (incl. inactive)   POST → upsert by key   DELETE ?key=

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { adminGate } from "@/lib/hc/admin-gate";
import { sanitizePlan } from "@/lib/hc/plan-sanitize";
import { PILLARS } from "@/lib/hc/types";

export const runtime = "nodejs";

const TABLES: Record<string, string> = {
  modules: "hc_plan_modules",
  templates: "hc_plan_templates",
  exercise: "hc_exercise_templates",
  nutrition: "hc_nutrition_templates",
};

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const slugify = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function rowFor(kind: string, b: Record<string, unknown>): Record<string, unknown> | string {
  const name = s(b.name ?? b.title, 200);
  if (!name) return "Heiti vantar.";
  const key = s(b.key, 100) || slugify(name);
  const base = { key, active: b.active !== false, updated_at: new Date().toISOString() };
  switch (kind) {
    case "modules": {
      if (!PILLARS.includes(b.pillar as never)) return "Veldu stoð.";
      return {
        ...base, pillar: b.pillar, title: name, summary: s(b.summary, 500) || "", details: s(b.details, 3000),
        frequency: s(b.frequency, 100),
        tags: (Array.isArray(b.tags) ? b.tags : String(b.tags || "").split(",")).map((t) => String(t).trim()).filter(Boolean).slice(0, 12),
        sort: Number(b.sort) || 0,
      };
    }
    case "templates":
      return {
        ...base, name, scenario: s(b.scenario, 300), description: s(b.description, 1000),
        module_keys: (Array.isArray(b.module_keys) ? b.module_keys : []).map(String).slice(0, 40),
        exercise_template_key: s(b.exercise_template_key, 100),
        nutrition_template_key: s(b.nutrition_template_key, 100),
        focus_pillars: (Array.isArray(b.focus_pillars) ? b.focus_pillars : []).filter((p) => PILLARS.includes(p as never)),
        sort: Number(b.sort) || 0,
      };
    case "exercise": {
      const clean = sanitizePlan({ exercise: { ...b, key } }).exercise!;
      return { ...base, name, level: clean.level, goal: clean.goal, days_per_week: clean.days_per_week, session_minutes: clean.session_minutes, description: clean.description, sessions: clean.sessions, principles: clean.principles ?? [], progression: clean.progression ?? [] };
    }
    case "nutrition": {
      const clean = sanitizePlan({ nutrition: { ...b, key } }).nutrition!;
      return { ...base, name, goal: clean.goal, description: clean.description, principles: clean.principles, day_example: clean.day_example };
    }
  }
  return "bad_kind";
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const g = await adminGate(req, false);
  if (g instanceof NextResponse) return g;
  const table = TABLES[(await ctx.params).kind];
  if (!table) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from(table).select("*").order("key");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const kind = (await ctx.params).kind;
  const table = TABLES[kind];
  if (!table) return NextResponse.json({ error: "bad_kind" }, { status: 400 });
  const row = rowFor(kind, await req.json().catch(() => ({})));
  if (typeof row === "string") return NextResponse.json({ error: row }, { status: 400 });
  const { data, error } = await supabaseAdmin.from(table).upsert(row, { onConflict: "key" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const g = await adminGate(req, true);
  if (g instanceof NextResponse) return g;
  const table = TABLES[(await ctx.params).kind];
  const key = req.nextUrl.searchParams.get("key");
  if (!table || !key) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  // Soft delete: plans already written keep their copied content either way,
  // but templates may reference the key.
  const { error } = await supabaseAdmin.from(table).update({ active: false }).eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
