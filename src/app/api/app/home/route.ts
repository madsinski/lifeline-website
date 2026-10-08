// What the Lifeline app's Home screen reads.
//
// Mirrors fhir-health-dashboard/src/screens/HomeScreen.tsx:688-740, which is
// the authority for this surface — not the heilsuferð model. The two are
// different products on one database: heilsuferð runs on hc_* tables, the app
// runs on clients.*_score, action_completions and the programme tables.
//
// The meters are computed server-side and stored on the client row; the grid
// is a seven-day count of completed actions. Both verified present:
// clients.consistency_score / intensity_score / consistency_depth_score /
// completion_score / consistency_score_7d / completion_score_7d /
// consistency_narrative, and the get_consistency_grid(p_client_id) function.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: c }, { data: grid }, { data: targets }, { data: meals }, { data: weight }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("consistency_score, intensity_score, consistency_depth_score, completion_score, consistency_score_7d, completion_score_7d, consistency_narrative")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin.rpc("get_consistency_grid", { p_client_id: user.id }),
    // The active target row, newest first — api.ts:getCurrentTargets().
    supabaseAdmin
      .from("macro_targets")
      .select("target_kcal, target_protein, target_carbs, target_fat")
      .eq("client_id", user.id)
      .eq("active", true)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("meal_log")
      .select("kcal, protein, carbs, fat")
      .eq("client_id", user.id)
      .eq("date", today),
    supabaseAdmin
      .from("weight_log")
      .select("recorded_at, weight_kg")
      .eq("client_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(2),
  ]);

  // Today's intake, summed here so the client does not have to.
  const eaten = (meals ?? []).reduce(
    (a, m) => ({
      kcal: a.kcal + Number(m.kcal ?? 0),
      protein: a.protein + Number(m.protein ?? 0),
      carbs: a.carbs + Number(m.carbs ?? 0),
      fat: a.fat + Number(m.fat ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  // The app's hero uses the 7-day variants for immediate feedback and keeps
  // the 28-day ones for the Activity page (HomeScreen.tsx:721-722).
  return NextResponse.json({
    meters: {
      consistency: c?.consistency_score ?? c?.consistency_depth_score ?? null,
      intensity: c?.intensity_score ?? null,
      completion: c?.completion_score ?? null,
      consistency7d: c?.consistency_score_7d ?? null,
      completion7d: c?.completion_score_7d ?? null,
      narrative: c?.consistency_narrative ?? null,
    },
    /** [{ date, done_count }] — one row per day with completions. */
    grid: (grid as { date: string; done_count: number }[] | null) ?? [],
    /**
     * Macros, which the app shows only to people who opted into tracking —
     * here that is simply whether an active target row exists.
     */
    macros: targets
      ? {
          target: {
            kcal: Number(targets.target_kcal), protein: Number(targets.target_protein),
            carbs: Number(targets.target_carbs), fat: Number(targets.target_fat),
          },
          eaten,
          meals: (meals ?? []).length,
        }
      : null,
    weight: weight?.length
      ? {
          kg: Number(weight[0].weight_kg),
          at: weight[0].recorded_at as string,
          /** The one before it, so the card can show a direction. */
          previousKg: weight[1] ? Number(weight[1].weight_kg) : null,
        }
      : null,
  });
}
