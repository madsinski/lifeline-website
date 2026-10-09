// Heilsan — the measurements, over time.
//
// Mirrors what MyHealthScreen reads: client_body_comp_measurements for scans,
// weight_log for weight. Blood markers live in health_records, a generic
// key/value store (record_type, key, label, value, unit, status) — verified
// empty across every client today, so the surface handles it being empty
// rather than pretending the feature is live.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const [{ data: scans }, { data: weights }, { data: records }] = await Promise.all([
    supabaseAdmin
      .from("client_body_comp_measurements")
      .select("measured_at, weight_kg, body_fat_pct, muscle_mass_pct, muscle_mass_kg, phase_angle, bmr_kcal, visceral_fat_idx, waist_cm, tbw_l, source")
      .eq("client_id", user.id)
      .order("measured_at", { ascending: true }),
    supabaseAdmin
      .from("weight_log")
      .select("recorded_at, weight_kg, body_fat_pct, source")
      .eq("client_id", user.id)
      .order("recorded_at", { ascending: true }),
    supabaseAdmin
      .from("health_records")
      .select("record_type, key, label, value, unit, status, recorded_at")
      .eq("client_id", user.id)
      .order("recorded_at", { ascending: false }),
  ]);

  return NextResponse.json({
    scans: (scans ?? []).map((s) => ({
      at: s.measured_at as string,
      source: (s.source as string) ?? null,
      weightKg: num(s.weight_kg), bodyFatPct: num(s.body_fat_pct),
      muscleMassPct: num(s.muscle_mass_pct), muscleMassKg: num(s.muscle_mass_kg),
      phaseAngle: num(s.phase_angle), bmrKcal: num(s.bmr_kcal),
      visceralFatIdx: num(s.visceral_fat_idx), waistCm: num(s.waist_cm), tbwL: num(s.tbw_l),
    })),
    weights: (weights ?? []).map((w) => ({
      at: w.recorded_at as string, kg: num(w.weight_kg), bodyFatPct: num(w.body_fat_pct),
      source: (w.source as string) ?? null,
    })),
    records: (records ?? []).map((r) => ({
      type: r.record_type as string, key: r.key as string, label: r.label as string,
      value: r.value as string, unit: (r.unit as string) ?? null,
      status: (r.status as string) ?? null, at: r.recorded_at as string,
    })),
  });
}
