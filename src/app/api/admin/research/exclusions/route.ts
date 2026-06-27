// POST /api/admin/research/exclusions — set a cohort's excluded patients (rows)
// and excluded features (columns), then recompute trends. Write-gated.
//
// Body: { cohortId, excludedPatients?: string[], excludedFeatures?: string[] }
// Tables: supabase/migration-research-data-schema.sql + migration-research-exclusions.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchWrite } from "@/lib/research/access";
import { recomputeCohortTrends } from "@/lib/research/recompute";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = await requireResearchWrite(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const cohortId = String(body?.cohortId || "");
  if (!cohortId) return NextResponse.json({ error: "bad_request", detail: "cohortId required" }, { status: 400 });

  const excludedPatients = Array.isArray(body?.excludedPatients) ? [...new Set(body.excludedPatients.map(String))] : [];
  const excludedFeatures = Array.isArray(body?.excludedFeatures) ? [...new Set(body.excludedFeatures.map(String))] : [];

  const { error } = await supabaseAdmin
    .from("research_cohorts")
    .update({ excluded_patients: excludedPatients, excluded_features: excludedFeatures, updated_at: new Date().toISOString() })
    .eq("id", cohortId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const trends = await recomputeCohortTrends(cohortId);

  await supabaseAdmin.from("research_access_log").insert({
    actor_id: auth.id, actor_email: auth.email ?? null, action: "exclusions", cohort_id: cohortId,
    detail: { excludedPatients: excludedPatients.length, excludedFeatures: excludedFeatures.length },
  });

  return NextResponse.json({ ok: true, excludedPatients, excludedFeatures, trends_recomputed: trends });
}
