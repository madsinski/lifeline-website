// GET    /api/admin/research/cohorts — list cohorts with summary counts
// POST   /api/admin/research/cohorts — create a cohort
// DELETE /api/admin/research/cohorts?id=… — delete a cohort (cascades exports/obs/answers)
//
// medical_advisor has full research access; lawyer is excluded. Reads gate on
// requireResearchRead, writes on requireResearchWrite (see lib/research/access).
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireResearchRead, requireResearchWrite } from "@/lib/research/access";

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "cohort";
}

export async function GET(req: NextRequest) {
  const user = await requireResearchRead(req);
  if (!user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { data: cohorts, error } = await supabaseAdmin
    .from("research_cohorts")
    .select("id, name, slug, description, pathway, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // attach per-cohort summary (export count, latest timepoint, patient count)
  const summaries = await Promise.all(
    (cohorts || []).map(async (c) => {
      const { data: exps } = await supabaseAdmin
        .from("research_exports")
        .select("timepoint_label, timepoint_order, export_type, exported_at, patient_count")
        .eq("cohort_id", c.id)
        .order("timepoint_order", { ascending: true });
      const { count: patientCount } = await supabaseAdmin
        .from("research_patients")
        .select("*", { count: "exact", head: true })
        .eq("cohort_id", c.id);
      return {
        ...c,
        patient_count: patientCount ?? 0,
        timepoints: (exps || []).map((e) => e.timepoint_label),
        exports: exps || [],
      };
    }),
  );
  return NextResponse.json({ cohorts: summaries });
}

export async function POST(req: NextRequest) {
  const auth = await requireResearchWrite(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ error: "bad_request", detail: "name required" }, { status: 400 });
  const slug = slugify(String(body?.slug || name));
  const { data, error } = await supabaseAdmin
    .from("research_cohorts")
    .insert({
      name, slug,
      description: body?.description ? String(body.description) : null,
      pathway: body?.pathway ? String(body.pathway) : null,
      created_by: auth.id,
    })
    .select("id, name, slug, description, pathway, created_at")
    .single();
  if (error) {
    const status = error.message.includes("duplicate") ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ ok: true, cohort: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireResearchWrite(req);
  if (typeof auth === "string") {
    return NextResponse.json({ error: auth }, { status: auth === "unauthorized" ? 401 : 403 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "bad_request", detail: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin.from("research_cohorts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("research_access_log").insert({
    actor_id: auth.id, actor_email: auth.email ?? null, action: "delete", cohort_id: id,
  });
  return NextResponse.json({ ok: true });
}
