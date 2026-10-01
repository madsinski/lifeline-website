// Read-only libraries for the participant's own plan:
//   ?kind=exercises&q=&cat=&equip=  → up to 48 exercises (images, Icelandic names)
//   ?kind=meals                     → the whole meal library (≈110 rows)
//   ?kind=programs                  → exercise + nutrition programmes to choose from
// Signed-in participants only; nothing personal is returned.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind");

  if (kind === "exercises") {
    const q = (sp.get("q") ?? "").trim().slice(0, 60).replace(/[%,()]/g, " ");
    let query = supabaseAdmin.from("exercises")
      .select("id, name, name_is, category, equipment, level, illustration_url, video_url, primary_muscles, bang_for_buck")
      .not("illustration_url", "is", null);
    const cat = sp.get("cat");
    if (cat && /^[a-z-]{2,20}$/.test(cat)) query = query.eq("category", cat);
    const equip = sp.get("equip");
    if (equip && /^[a-z -]{2,30}$/.test(equip)) query = query.eq("equipment", equip);
    if (q) query = query.or(`name.ilike.%${q}%,name_is.ilike.%${q}%`);
    const { data, error } = await query.order("bang_for_buck", { ascending: false, nullsFirst: false }).order("priority", { ascending: false, nullsFirst: false }).order("name").limit(48);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exercises: data || [] }, { headers: { "Cache-Control": "private, max-age=300" } });
  }

  if (kind === "meals") {
    const { data, error } = await supabaseAdmin.from("meals")
      .select("id, name, name_is, description, description_is, category, ingredients, ingredients_is, instructions, instructions_is, prep_time_min, cook_time_min, calories, protein, carbs, fat, dietary_tags, illustration_url")
      .or("is_filler.is.null,is_filler.eq.false");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ meals: data || [] }, { headers: { "Cache-Control": "private, max-age=300" } });
  }

  if (kind === "programs") {
    const [ex, nu] = await Promise.all([
      supabaseAdmin.from("hc_exercise_templates").select("key, name, level, goal, days_per_week, session_minutes, description").eq("active", true).order("name"),
      supabaseAdmin.from("hc_nutrition_templates").select("key, name, goal, description, principles").eq("active", true).order("name"),
    ]);
    return NextResponse.json({ exercise: ex.data || [], nutrition: nu.data || [] });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
