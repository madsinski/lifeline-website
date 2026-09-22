// Read-only action-plan library for the builder: modules, scenario
// templates, exercise and nutrition templates. Managed in /admin/coach/plans.
// Actor: workstation session or Lifeline staff.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getHcActor } from "@/lib/hc/ws-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [modules, templates, exercise, nutrition] = await Promise.all([
    supabaseAdmin.from("hc_plan_modules").select("*").eq("active", true).order("pillar").order("sort"),
    supabaseAdmin.from("hc_plan_templates").select("*").eq("active", true).order("sort"),
    supabaseAdmin.from("hc_exercise_templates").select("*").eq("active", true).order("name"),
    supabaseAdmin.from("hc_nutrition_templates").select("*").eq("active", true).order("name"),
  ]);
  return NextResponse.json({
    modules: modules.data || [],
    templates: templates.data || [],
    exercise: exercise.data || [],
    nutrition: nutrition.data || [],
  });
}
