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
import { APPOINTMENT_KIND, UPCOMING_STATUS, parseAppointment } from "@/lib/app/appointment-date";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const today = new Date().toISOString().slice(0, 10);
  const [
    { data: c }, { data: grid }, { data: targets }, { data: meals }, { data: weight },
    { data: scan }, { data: transition }, { data: deload }, { data: programs },
    { data: appointments }, { data: answers },
  ] = await Promise.all([
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
    // Latest body-comp scan — the "Current insights" card.
    supabaseAdmin
      .from("client_body_comp_measurements")
      .select("measured_at, weight_kg, body_fat_pct, muscle_mass_pct, phase_angle, bmr_kcal, visceral_fat_idx")
      .eq("client_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Both banner RPCs. Only one banner ever renders — see the client.
    supabaseAdmin.rpc("suggest_next_program", { p_client_id: user.id }),
    supabaseAdmin.rpc("check_deload_recommendation", { p_client_id: user.id }),
    // The state behind "What's coming up": programmes chosen, appointments
    // booked, questionnaire progress.
    supabaseAdmin.from("client_programs").select("category_key").eq("client_id", user.id),
    // No date filter here on purpose: `date` is text holding "April 13,
    // 2026", so .gte() against an ISO string compares alphabetically and
    // every April row passes. Status is a real enum-ish text and does filter.
    supabaseAdmin
      .from("appointments")
      .select("type, date, time, station_name, package_name, coach_name")
      .eq("client_id", user.id)
      .eq("status", UPCOMING_STATUS),
    supabaseAdmin.from("questionnaire_responses").select("question_key").eq("client_id", user.id),
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
    scan: scan
      ? {
          at: scan.measured_at as string,
          weightKg: scan.weight_kg == null ? null : Number(scan.weight_kg),
          bodyFatPct: scan.body_fat_pct == null ? null : Number(scan.body_fat_pct),
          muscleMassPct: scan.muscle_mass_pct == null ? null : Number(scan.muscle_mass_pct),
          phaseAngle: scan.phase_angle == null ? null : Number(scan.phase_angle),
          bmrKcal: scan.bmr_kcal == null ? null : Number(scan.bmr_kcal),
          visceralFatIdx: scan.visceral_fat_idx == null ? null : Number(scan.visceral_fat_idx),
        }
      : null,
    /**
     * One banner at most, in the app's own priority order: a programme
     * transition outranks a deload suggestion (HomeScreen.tsx:2146-2156).
     */
    banner: (() => {
      const tr = (transition as { next?: string; reason?: string }[] | null)?.[0];
      if (tr?.next) return { kind: "transition" as const, next: tr.next, reason: tr.reason ?? null };
      if (deload === true) return { kind: "deload" as const };
      return null;
    })(),
    /** The next-step list. Each item is a piece of account state, not a date. */
    upcoming: (() => {
      const items: { key: string; at?: string; detail?: string | null }[] = [];
      if (!programs?.length) items.push({ key: "choose-programs" });
      if (!answers?.length) items.push({ key: "questionnaire" });
      // Parse, drop what is already past, soonest first.
      const now = Date.now();
      const appts = (appointments ?? [])
        .map((a) => ({ a, at: parseAppointment(a.date, a.time) }))
        .filter((x): x is { a: typeof x.a; at: Date } => x.at !== null && x.at.getTime() >= now)
        .sort((x, y) => x.at.getTime() - y.at.getTime());
      for (const { a, at } of appts) {
        const key = APPOINTMENT_KIND[a.type];
        if (!key) continue;
        items.push({
          key,
          // ISO so the client can write the date in the reader's language;
          // the stored string is English prose and cannot be translated.
          at: at.toISOString(),
          detail: a.station_name ?? a.coach_name ?? a.package_name ?? null,
        });
      }
      return items;
    })(),
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
