// Meal library search for the plan builder (/vinnustod + /admin/coach/plans).
// Reads the same `meals` table that /admin/content manages.
// GET ?q=&category=&tag=&limit=
// Actor: workstation session or Lifeline staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

const COLUMNS =
  "id, name, description, category, ingredients, instructions, prep_time_min, calories, protein, carbs, fat, dietary_tags, illustration_url";
const CATEGORIES = ["breakfast", "lunch", "dinner", "snack", "dessert"];

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim().slice(0, 60).replace(/[%,()*]/g, " ");
  const category = sp.get("category");
  const tag = (sp.get("tag") || "").trim().slice(0, 40).replace(/[%,(){}*]/g, "");
  const limit = Math.max(1, Math.min(60, Number(sp.get("limit")) || 36));

  let query = supabaseAdmin.from("meals").select(COLUMNS);
  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (category && CATEGORIES.includes(category)) query = query.eq("category", category);
  if (tag) query = query.contains("dietary_tags", [tag]);

  const { data, error } = await query.order("protein", { ascending: false, nullsFirst: false }).limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meals: data || [] });
}
