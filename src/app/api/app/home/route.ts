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

  const [{ data: c }, { data: grid }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("consistency_score, intensity_score, consistency_depth_score, completion_score, consistency_score_7d, completion_score_7d, consistency_narrative")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseAdmin.rpc("get_consistency_grid", { p_client_id: user.id }),
  ]);

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
  });
}
