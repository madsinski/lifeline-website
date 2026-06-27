// GET /api/admin/research/export?cohortId=…&sheet=wide|long|answers&timepoint=…
// Streams a CSV (UTF-8 BOM so Excel renders Icelandic) of the cohort data.
//   long    — one row per observation across all timepoints
//   answers — raw questionnaire item responses
//   wide    — one row per patient per timepoint, columns = features
//
// Tables: supabase/migration-research-data-schema.sql

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import { buildResearchWorkbook, type WbObservation, type WbAnswer } from "@/lib/research/workbook";

export const maxDuration = 120;

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: unknown[][]): string => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

async function pageAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const cohortId = req.nextUrl.searchParams.get("cohortId");
  const sheet = req.nextUrl.searchParams.get("sheet") || "long";
  const timepoint = req.nextUrl.searchParams.get("timepoint");
  if (!cohortId) return NextResponse.json({ error: "bad_request", detail: "cohortId required" }, { status: 400 });

  const { data: cohort } = await supabaseAdmin
    .from("research_cohorts").select("slug, name").eq("id", cohortId).single();
  const slug = cohort?.slug || "cohort";

  // ---- full multi-sheet Excel workbook (default) ----
  if (sheet === "excel" || sheet === "xlsx") {
    const observations = await pageAll<WbObservation>((from, to) =>
      supabaseAdmin.from("research_observations")
        .select("medalia_patient_id, timepoint_label, timepoint_order, obs_type, code, feature, display, observed_at, value_num, value_text, value_bool, unit")
        .eq("cohort_id", cohortId).range(from, to));
    const ans = await pageAll<WbAnswer>((from, to) =>
      supabaseAdmin.from("research_answers")
        .select("medalia_patient_id, questionnaire_title, authored_at, link_id, question_text, value_text")
        .eq("cohort_id", cohortId).range(from, to));
    const buf = await buildResearchWorkbook(cohort?.name || slug, observations, ans);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${slug}_research.xlsx"`,
      },
    });
  }

  let csv: string;
  let name: string;

  if (sheet === "answers") {
    const rows = await pageAll<Record<string, unknown>>((from, to) =>
      supabaseAdmin.from("research_answers")
        .select("medalia_patient_id, questionnaire_title, authored_at, link_id, question_text, value_text")
        .eq("cohort_id", cohortId).range(from, to));
    const header = ["patientId", "questionnaireTitle", "authored", "linkId", "questionText", "value"];
    csv = toCsv([header, ...rows.map((r) => [r.medalia_patient_id, r.questionnaire_title, r.authored_at, r.link_id, r.question_text, r.value_text])]);
    name = `${slug}_answers.csv`;
  } else if (sheet === "wide") {
    const obs = await pageAll<Record<string, unknown>>((from, to) => {
      let q = supabaseAdmin.from("research_observations")
        .select("medalia_patient_id, timepoint_label, timepoint_order, feature, value_num, value_text, value_bool")
        .eq("cohort_id", cohortId);
      if (timepoint) q = q.eq("timepoint_label", timepoint);
      return q.range(from, to);
    });
    const features = [...new Set(obs.map((o) => String(o.feature)))].sort();
    const rowKey = (o: Record<string, unknown>) => `${o.medalia_patient_id}@@${o.timepoint_label}`;
    const grid = new Map<string, Record<string, unknown>>();
    for (const o of obs) {
      const k = rowKey(o);
      if (!grid.has(k)) grid.set(k, { patientId: o.medalia_patient_id, timepoint: o.timepoint_label, order: o.timepoint_order });
      const val = o.value_num ?? o.value_text ?? o.value_bool;
      if (val !== null && val !== undefined) grid.get(k)![String(o.feature)] = val;
    }
    const ordered = [...grid.values()].sort((a, b) =>
      String(a.patientId).localeCompare(String(b.patientId)) || Number(a.order) - Number(b.order));
    const header = ["patientId", "timepoint", ...features];
    csv = toCsv([header, ...ordered.map((r) => [r.patientId, r.timepoint, ...features.map((f) => r[f])])]);
    name = `${slug}_wide${timepoint ? "_" + timepoint : ""}.csv`;
  } else {
    const rows = await pageAll<Record<string, unknown>>((from, to) =>
      supabaseAdmin.from("research_observations")
        .select("medalia_patient_id, timepoint_label, obs_type, code, feature, display, observed_at, value_num, value_text, value_bool, unit")
        .eq("cohort_id", cohortId).range(from, to));
    const header = ["patientId", "timepoint", "type", "code", "feature", "display", "date", "value_num", "value_text", "value_bool", "unit"];
    csv = toCsv([header, ...rows.map((r) => [r.medalia_patient_id, r.timepoint_label, r.obs_type, r.code, r.feature, r.display, r.observed_at, r.value_num, r.value_text, r.value_bool, r.unit])]);
    name = `${slug}_long.csv`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
