// DELETE /api/admin/research/timepoint?id=<exportId>
// Delete a single timepoint (research_exports row) and its observations/answers
// (cascade), then recompute the cohort's trends. Lets you remove a test upload
// without dropping the whole cohort.
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchWrite } from "@/lib/research/access";
import { recomputeCohortTrends } from "@/lib/research/recompute";

export async function DELETE(req: NextRequest) {
  const auth = await requireResearchWrite(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request", detail: "id required" }, { status: 400 });

  const { data: exp } = await supabaseAdmin
    .from("research_exports").select("id, cohort_id, timepoint_label").eq("id", id).maybeSingle();
  if (!exp) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { error } = await supabaseAdmin.from("research_exports").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // patients are cohort-level; drop any now orphaned by this delete
  const { data: remaining } = await supabaseAdmin
    .from("research_observations").select("medalia_patient_id").eq("cohort_id", exp.cohort_id);
  const stillPresent = new Set((remaining || []).map((r) => r.medalia_patient_id));
  const { data: pats } = await supabaseAdmin
    .from("research_patients").select("id, medalia_patient_id").eq("cohort_id", exp.cohort_id);
  const orphans = (pats || []).filter((p) => !stillPresent.has(p.medalia_patient_id)).map((p) => p.id);
  if (orphans.length) await supabaseAdmin.from("research_patients").delete().in("id", orphans);

  const trends = await recomputeCohortTrends(exp.cohort_id);

  await supabaseAdmin.from("research_access_log").insert({
    actor_id: auth.id, actor_email: auth.email ?? null, action: "delete",
    cohort_id: exp.cohort_id, export_id: id, detail: { timepoint: exp.timepoint_label, scope: "timepoint" },
  });

  return NextResponse.json({ ok: true, deleted: exp.timepoint_label, trends_recomputed: trends });
}
