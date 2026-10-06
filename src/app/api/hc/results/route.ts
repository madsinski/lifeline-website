// The participant records their own measurements.
//
// GET  → every value on their journey, whoever recorded it.
// POST { values: [{marker, value, unit?, measured_at?, note?}] }
//   → upsert, source 'self'. A null value deletes that marker, but only one
//     they entered themselves.
//
// Self-entered values never overwrite clinically measured ones. A number read
// off a home blood-pressure cuff and a number from the measurement station
// are not the same evidence, and the one taken under supervision wins. The
// nurse's value stays and the participant is told which were left alone.
//
// Schema: supabase/migration-hc-results.sql. Encrypted through the same
// hc_results_upsert RPC the workstation uses.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { currentJourney, hcAudit, requireUser } from "@/lib/hc/server";

export const runtime = "nodejs";

/** What the workstation and the doctor record. Anything else is ours to replace. */
const CLINICAL = new Set(["manual", "report", "medalia", "biody", "station"]);

const read = async (journeyId: string) => {
  const { data } = await supabaseAdmin
    .from("hc_results_decrypted")
    .select("marker, value, unit, measured_at, source, note, entered_by, updated_at")
    .eq("journey_id", journeyId);
  return data || [];
};

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "Engin heilsuferð fannst." }, { status: 404 });
  return NextResponse.json({ results: await read(journey.id) });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;
  const journey = await currentJourney(user.id);
  if (!journey) return NextResponse.json({ error: "Engin heilsuferð fannst." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.values)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const existing = await read(journey.id);
  const sourceOf = new Map(existing.map((r) => [r.marker as string, (r.source as string) ?? ""]));
  const now = new Date().toISOString();
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

  const rows: Record<string, unknown>[] = [];
  const drop: string[] = [];
  const refused: string[] = [];

  for (const v of body.values as Record<string, unknown>[]) {
    const marker = str(v?.marker, 60);
    if (!marker) continue;
    if (CLINICAL.has(sourceOf.get(marker) ?? "")) { refused.push(marker); continue; }
    const n = v?.value === "" || v?.value == null ? null : Number(v.value);
    if (n == null || !Number.isFinite(n)) { drop.push(marker); continue; }
    rows.push({
      journey_id: journey.id, client_id: user.id, marker,
      value: n, unit: str(v?.unit, 30), measured_at: date(v?.measured_at),
      source: "self", note: str(v?.note, 300), entered_by: "self", updated_at: now,
    });
  }

  if (drop.length) {
    const { error } = await supabaseAdmin.from("hc_results")
      .delete().eq("journey_id", journey.id).eq("source", "self").in("marker", drop);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (rows.length) {
    const { error } = await supabaseAdmin.rpc("hc_results_upsert", { p_rows: rows });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await hcAudit(user.id, "results_self", journey.id, { markers: rows.length });
  }

  return NextResponse.json({
    results: await read(journey.id),
    refused: refused.length ? refused : undefined,
  });
}
