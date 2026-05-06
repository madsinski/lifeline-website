// GET /api/admin/surveys/[id]/export
// CSV export of every completed response for a single survey.
// One row per assignment; one column per question (in survey order).
// Values are coerced to single-cell strings (multi-select joined by
// "|"). Assignment metadata (sent_at, completed_at, recipient email)
// is included as leading columns.
//
// Visible to admin and medical_advisor.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface QuestionRow {
  id: string;
  order_index: number;
  question_type: string;
  label_is: string;
  options_jsonb: { value: string; label_is: string }[] | null;
}
interface AssignmentRow {
  id: string;
  sent_at: string;
  completed_at: string | null;
  client_email: string;
  client_name: string | null;
  sent_by_name: string | null;
}
interface ResponseRow {
  assignment_id: string;
  question_id: string;
  value: string | null;
  values_array: string[] | null;
  text_value: string | null;
  skipped: boolean;
}

function escapeCsv(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: surveyId } = await ctx.params;

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData.user?.email) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }
  const { data: staffRow } = await supabaseAdmin
    .from("staff")
    .select("id, role, active")
    .eq("email", userData.user.email)
    .maybeSingle();
  if (!staffRow || !staffRow.active || (staffRow.role !== "admin" && staffRow.role !== "medical_advisor")) {
    return NextResponse.json({ ok: false, error: "Admin or medical_advisor role required" }, { status: 403 });
  }

  // Load survey + questions
  const { data: surveyRow } = await supabaseAdmin
    .from("feedback_surveys")
    .select("id, key, version, title_is")
    .eq("id", surveyId)
    .maybeSingle();
  if (!surveyRow) {
    return NextResponse.json({ ok: false, error: "Survey not found" }, { status: 404 });
  }
  const { data: qRows } = await supabaseAdmin
    .from("feedback_questions")
    .select("id, order_index, question_type, label_is, options_jsonb")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true });
  const questions = (qRows || []) as QuestionRow[];

  // Load completed assignments + their responses
  const { data: aRows } = await supabaseAdmin
    .from("feedback_assignments")
    .select("id, sent_at, completed_at, client_email, client_name, sent_by_name")
    .eq("survey_id", surveyId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });
  const assignments = (aRows || []) as AssignmentRow[];

  let responses: ResponseRow[] = [];
  if (assignments.length > 0) {
    const ids = assignments.map((a) => a.id);
    // Read from the decrypted view — text_value is encrypted at rest.
    const { data: rRows } = await supabaseAdmin
      .from("feedback_responses_decrypted")
      .select("assignment_id, question_id, value, values_array, text_value, skipped")
      .in("assignment_id", ids);
    responses = (rRows || []) as ResponseRow[];
  }

  // Index responses by (assignment_id, question_id)
  const respIdx = new Map<string, ResponseRow>();
  for (const r of responses) {
    respIdx.set(`${r.assignment_id}::${r.question_id}`, r);
  }

  // Pre-compute option-label maps so we can render readable values
  // ("Mjög gott") instead of raw codes ("5") in the CSV.
  const optionLabel = new Map<string, Map<string, string>>();
  for (const q of questions) {
    if (q.options_jsonb && Array.isArray(q.options_jsonb)) {
      const m = new Map<string, string>();
      for (const o of q.options_jsonb) m.set(o.value, o.label_is);
      optionLabel.set(q.id, m);
    }
  }

  // Build CSV
  const headerRow = [
    "assignment_id",
    "client_email",
    "client_name",
    "sent_by",
    "sent_at",
    "completed_at",
    ...questions.map((q) => `Q${q.order_index}: ${q.label_is}`),
  ];
  const lines: string[] = [];
  lines.push(headerRow.map(escapeCsv).join(","));

  for (const a of assignments) {
    const cells: string[] = [
      a.id,
      a.client_email,
      a.client_name || "",
      a.sent_by_name || "",
      a.sent_at,
      a.completed_at || "",
    ];
    for (const q of questions) {
      const r = respIdx.get(`${a.id}::${q.id}`);
      if (!r) {
        cells.push("");
        continue;
      }
      if (r.skipped) {
        cells.push("[skipped]");
        continue;
      }
      const labels = optionLabel.get(q.id);
      switch (q.question_type) {
        case "likert5":
        case "singleselect":
          cells.push(labels && r.value ? (labels.get(r.value) || r.value) : (r.value || ""));
          break;
        case "nps10":
          cells.push(r.value || "");
          break;
        case "multiselect":
          cells.push(
            (r.values_array || [])
              .map((v) => (labels?.get(v) || v))
              .join(" | "),
          );
          break;
        case "open":
          cells.push(r.text_value || "");
          break;
        case "consent_optional":
          cells.push(`${r.value || ""}${r.text_value ? `: ${r.text_value}` : ""}`);
          break;
        default:
          cells.push(r.value || r.text_value || "");
      }
    }
    lines.push(cells.map(escapeCsv).join(","));
  }

  // BOM for Excel-friendly UTF-8 (Icelandic chars)
  const csv = "﻿" + lines.join("\r\n");
  const filename = `${surveyRow.key}-v${surveyRow.version}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
