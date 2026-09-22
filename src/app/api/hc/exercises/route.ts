// Exercise library search for the plan builder (/vinnustod + /admin/coach/plans).
// Reads the same `exercises` table that /admin/content manages.
// GET ?q=&category=&equipment=&best=1&limit=
// Actor: workstation session or Lifeline staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

const COLUMNS =
  "id, name, category, equipment, level, mechanic, illustration_url, video_url, instructions, primary_muscles, secondary_muscles, bang_for_buck, priority";
const CATEGORIES = ["legs", "back", "chest", "shoulders", "arms", "core", "full-body", "cardio", "warm-up", "flexibility"];
const EQUIPMENT = ["bodyweight", "dumbbells", "kettlebell", "bands", "barbell", "cables", "machine", "other", "none"];

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 60).replace(/[%,()*]/g, " ");
  const category = sp.get("category");
  const equipment = sp.get("equipment");
  const limit = Math.max(1, Math.min(80, Number(sp.get("limit")) || 48));

  let query = supabaseAdmin.from("exercises").select(COLUMNS);
  if (q) {
    const muscle = /^[a-z]+$/i.test(q) ? `,primary_muscles.cs.{${q.toLowerCase()}}` : "";
    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%${muscle}`);
  }
  if (category && CATEGORIES.includes(category)) query = query.eq("category", category);
  if (equipment && EQUIPMENT.includes(equipment)) {
    query = equipment === "bodyweight" ? query.in("equipment", ["bodyweight", "none"]) : query.eq("equipment", equipment);
  }
  if (sp.get("best") === "1") query = query.or("bang_for_buck.eq.true,mechanic.eq.compound");

  // Best value first: flagged bang-for-buck, compound, with a video, easy.
  const { data, error } = await query
    .order("bang_for_buck", { ascending: false, nullsFirst: false })
    .order("priority", { ascending: true, nullsFirst: false })
    .order("name")
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = (data || [])
    .map((r) => ({
      ...r,
      score: (r.bang_for_buck ? 4 : 0) + (r.mechanic === "compound" ? 2 : 0) + (r.video_url ? 2 : 0) + (r.illustration_url ? 1 : 0) + (r.level === "beginner" ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, priority: _p, ...r }) => { void _s; void _p; return r; });
  return NextResponse.json({ exercises: rows });
}
