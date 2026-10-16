// Measured values for one journey (hc_results) — what Lifeline's own
// measurement station measured.
// GET  ?journey=<id>     → the values recorded so far (any source)
// POST { journey_id, values: [{marker, value, unit?, measured_at?, note?}] }
//   → upsert; a null/empty value deletes that marker.
//
// Medalia split (2026-10-16): only station markers (body composition, BMI,
// weight, fat, muscle, VO2max, strength, blood pressure — src/lib/hc/markers.ts)
// are accepted. Blood values are Medalia's and come in the report: a blood
// marker is refused with 400. Rows are written with source 'station'.
// Actor: workstation session or Lifeline staff, limited to their locations.
// Schema: supabase/migration-hc-results.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { actorLocationFilter, getHcActor } from "@/lib/hc/ws-auth";
import { BLOOD_ENTRY_REFUSED, NOT_STATION_REFUSED, isBloodMarker, isStationMarker } from "@/lib/hc/markers";

export const runtime = "nodejs";

/** The journey, if this actor is allowed to see it. */
async function journeyFor(id: string, locs: string[] | null) {
  const { data } = await supabaseAdmin
    .from("hc_journeys")
    .select("id, client_id, location_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  if (locs && (!data.location_id || !locs.includes(data.location_id))) return null;
  return data;
}

export async function GET(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const journeyId = req.nextUrl.searchParams.get("journey");
  if (!journeyId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const journey = await journeyFor(journeyId, actorLocationFilter(actor));
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("hc_results_decrypted")
    .select("marker, value, unit, measured_at, source, note, entered_by, updated_at")
    .eq("journey_id", journeyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ results: data || [] });
}

export async function POST(req: NextRequest) {
  const actor = await getHcActor(req);
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const journeyId = typeof body.journey_id === "string" ? body.journey_id : "";
  if (!journeyId || !Array.isArray(body.values)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const journey = await journeyFor(journeyId, actorLocationFilter(actor));
  if (!journey) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date().toISOString();
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  // Station measurements in the reference book, so one added later is
  // accepted without a code change.
  const { data: body_ } = await supabaseAdmin.from("hc_knowledge").select("slug").eq("category", "body");
  const bodySlugs = new Set((body_ ?? []).map((k) => k.slug as string));

  const rows: Record<string, unknown>[] = [];
  const drop: string[] = [];
  for (const v of body.values as Record<string, unknown>[]) {
    const marker = str(v?.marker, 60);
    if (!marker) continue;
    if (isBloodMarker(marker)) return NextResponse.json({ error: BLOOD_ENTRY_REFUSED, marker }, { status: 400 });
    if (!isStationMarker(marker, bodySlugs)) return NextResponse.json({ error: NOT_STATION_REFUSED, marker }, { status: 400 });
    const n = v?.value === "" || v?.value == null ? null : Number(v.value);
    if (n == null || !Number.isFinite(n)) { drop.push(marker); continue; }
    rows.push({
      journey_id: journeyId, client_id: journey.client_id, marker,
      value: n, unit: str(v?.unit, 30), measured_at: date(v?.measured_at),
      source: "station", note: str(v?.note, 300), entered_by: actor.label, updated_at: now,
    });
  }

  if (drop.length) {
    const { error } = await supabaseAdmin.from("hc_results").delete().eq("journey_id", journeyId).in("marker", drop)
      // Only what staff entered; report-derived and self-entered rows are not theirs to remove.
      .in("source", ["manual", "station"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (rows.length) {
    const { error } = await supabaseAdmin.rpc("hc_results_upsert", { p_rows: rows }); // encrypted upsert (migration-hc-encrypt-results-plans-2.sql)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from("hc_results_decrypted")
    .select("marker, value, unit, measured_at, source, note, entered_by, updated_at")
    .eq("journey_id", journeyId);
  return NextResponse.json({ results: data || [] });
}
