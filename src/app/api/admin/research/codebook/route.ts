// GET /api/admin/research/codebook?cohortId=… — construct-validity check:
// Pearson r between each proprietary 0–10 score and its underlying validated
// instrument (pooled across timepoints, paired within patient+timepoint).
// The variable dictionary itself is built client-side from the cohort series.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchRead } from "@/lib/research/access";
import { VALIDATION_PAIRS } from "@/lib/research/clinical";

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...data); if (data.length < PAGE) break;
  }
  return out;
}

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 8) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export async function GET(req: NextRequest) {
  const user = await requireResearchRead(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cohortId = req.nextUrl.searchParams.get("cohortId");
  if (!cohortId) return NextResponse.json({ error: "bad_request", detail: "cohortId required" }, { status: 400 });

  const feats = [...new Set(VALIDATION_PAIRS.flatMap((p) => [p.score, p.instrument]))];
  const obs = await pageAll<{ medalia_patient_id: string; feature: string; timepoint_order: number; value_num: number | null }>(
    (from, to) => supabaseAdmin.from("research_observations")
      .select("medalia_patient_id, feature, timepoint_order, value_num")
      .eq("cohort_id", cohortId).in("feature", feats).range(from, to),
  );
  // key = patient|timepoint -> { feature: value }
  const byKey = new Map<string, Record<string, number>>();
  for (const o of obs) {
    if (o.value_num === null || o.value_num === undefined) continue;
    const k = `${o.medalia_patient_id}|${o.timepoint_order}`;
    (byKey.get(k) ?? byKey.set(k, {}).get(k)!)[o.feature] = o.value_num;
  }
  const rows = [...byKey.values()];

  const validations = VALIDATION_PAIRS.map((p) => {
    const xs: number[] = [], ys: number[] = [];
    for (const r of rows) if (p.score in r && p.instrument in r) { xs.push(r[p.score]); ys.push(r[p.instrument]); }
    const r = pearson(xs, ys);
    const ok = r === null ? null : (p.expect === "neg" ? r < -0.3 : r > 0.3);
    return { label: p.label, score: p.score, instrument: p.instrument, expect: p.expect, r: r === null ? null : Math.round(r * 100) / 100, n: xs.length, ok };
  }).filter((v) => v.n > 0);

  return NextResponse.json({ validations });
}
