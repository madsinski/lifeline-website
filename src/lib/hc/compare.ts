// "Þá og nú": the same markers from two health checks side by side, for the
// re-evaluation. Reads hc_results of the participant's earlier journey and the
// current one. Server-only (the route hands the rows to the page).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { trafficLights } from "./analyze";
import type { KnowledgeEntry } from "./knowledge";

export interface CompareRow {
  marker: string;
  title: string;
  unit: string | null;
  before: number;
  after: number;
  /** before → after in the right direction (null: no direction or no change) */
  better: boolean | null;
  signalBefore: "red" | "yellow" | "green" | null;
  signalAfter: "red" | "yellow" | "green" | null;
}
export interface Comparison { beforeDate: string | null; afterDate: string | null; rows: CompareRow[] }

type R = { marker: string; value: number; unit: string | null; measured_at: string | null };

/** The latest earlier journey with results vs this one; null when there is nothing to compare. */
export async function compareJourneys(clientId: string, journeyId: string, sex: "m" | "f" | null): Promise<Comparison | null> {
  const { data: journeys } = await supabaseAdmin.from("hc_journeys").select("id, created_at")
    .eq("client_id", clientId).order("created_at", { ascending: false });
  const earlier = (journeys || []).filter((j) => j.id !== journeyId);
  if (!earlier.length) return null;
  const ids = [journeyId, ...earlier.map((j) => j.id)];
  const [{ data: res }, { data: entries }] = await Promise.all([
    supabaseAdmin.from("hc_results").select("journey_id, marker, value, unit, measured_at").in("journey_id", ids),
    supabaseAdmin.from("hc_knowledge").select("slug, category, title, aliases, unit, summary, body_md, bands, higher_better, sources, tags, sort").eq("active", true),
  ]);
  const by = new Map<string, R[]>();
  for (const r of (res || []) as (R & { journey_id: string })[]) {
    if (!by.has(r.journey_id)) by.set(r.journey_id, []);
    by.get(r.journey_id)!.push({ ...r, value: Number(r.value) });
  }
  const now = by.get(journeyId) ?? [];
  const prevId = earlier.find((j) => (by.get(j.id) ?? []).length)?.id;
  if (!now.length || !prevId) return null;
  const then = by.get(prevId)!;
  const ents = (entries || []) as KnowledgeEntry[];
  const lit = (rs: R[]) => new Map(trafficLights(rs, ents, sex).map((f) => [f.slug, f.signal]));
  const litNow = lit(now), litThen = lit(then);
  const rows: CompareRow[] = [];
  for (const a of now) {
    const b = then.find((x) => x.marker === a.marker);
    if (!b || !Number.isFinite(a.value) || !Number.isFinite(b.value)) continue;
    const e = ents.find((x) => x.slug === a.marker);
    const diff = a.value - b.value;
    rows.push({
      marker: a.marker, title: e?.title ?? a.marker, unit: a.unit ?? e?.unit ?? null,
      before: b.value, after: a.value,
      better: e?.higher_better == null || diff === 0 ? null : e.higher_better ? diff > 0 : diff < 0,
      signalBefore: litThen.get(a.marker) ?? null, signalAfter: litNow.get(a.marker) ?? null,
    });
  }
  const date = (rs: R[]) => rs.map((r) => r.measured_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
  // Improvements and worsenings first, unchanged last.
  rows.sort((x, y) => Number(y.better !== null) - Number(x.better !== null) || x.title.localeCompare(y.title, "is"));
  return rows.length ? { beforeDate: date(then), afterDate: date(now), rows } : null;
}
